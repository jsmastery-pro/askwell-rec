-- Phase 3 database pieces: the private `knowledge` bucket (project.md §6.4) and the functions the
-- knowledge and chat routes call (§6.4, §6.6, §7). The ones that count check and write under a
-- row lock or in one statement, so parallel requests can't both pass. Only service_role may
-- execute them.

-- Storage bucket -------------------------------------------------------------
-- Size and types must match MAX_KNOWLEDGE_FILE_BYTES and KNOWLEDGE_FILE_MIME_TYPES in
-- packages/shared (packages/db/test checks both). No storage.objects policies: only the
-- server's service role touches it, through one-time signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('knowledge', 'knowledge', false, 10485760, array['application/pdf', 'text/markdown', 'text/plain'])
  on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- reserve_knowledge_source ---------------------------------------------------
-- Files reserve as 'uploading' with their storage key; pasted text reserves as 'processing'
-- with a null key. p_limit is the plan's knowledgeSourcesPerProject from PLAN_LIMITS.
-- The project row is locked before counting. Stale reservations ('uploading' for over 2 hours)
-- are deleted first, so they stop counting; there is no cron.
-- Raises 'limit_reached' (SQLSTATE P0001) when the project already has p_limit sources.

create function public.reserve_knowledge_source(
  p_project_id uuid,
  p_title text,
  p_type text,
  p_storage_key text,
  p_status text,
  p_limit integer
)
  returns public.knowledge_sources
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_count integer;
  v_source public.knowledge_sources;
begin
  if p_status not in ('uploading', 'processing') then
    raise exception 'reserve_knowledge_source: invalid status %', p_status;
  end if;

  perform 1 from public.projects p where p.id = p_project_id for update;
  if not found then
    raise exception 'reserve_knowledge_source: no project %', p_project_id;
  end if;

  delete from public.knowledge_sources s
    where s.project_id = p_project_id
      and s.status = 'uploading'
      and s.created_at < now() - interval '2 hours';

  select count(*) into v_count from public.knowledge_sources s where s.project_id = p_project_id;
  if v_count >= p_limit then
    raise exception 'limit_reached' using errcode = 'P0001';
  end if;

  insert into public.knowledge_sources (project_id, title, type, storage_key, status)
    values (p_project_id, p_title, p_type, p_storage_key, p_status)
    returning * into v_source;

  return v_source;
end;
$$;

-- claim_knowledge_source -----------------------------------------------------
-- Finalize moves a reservation from 'uploading' to 'processing'. True only for the one call
-- that made the change; a second call, another project's id or any other status gets false.

create function public.claim_knowledge_source(p_source_id uuid, p_project_id uuid)
  returns boolean
  language sql
  security invoker
  set search_path = ''
as $$
  with claimed as (
    update public.knowledge_sources s
      set status = 'processing'
      where s.id = p_source_id and s.project_id = p_project_id and s.status = 'uploading'
      returning 1
  )
  select exists (select 1 from claimed)
$$;

-- consume_message ------------------------------------------------------------
-- Counts one message against the project's monthly quota. p_limit is the plan's
-- messagesPerMonthPerProject from PLAN_LIMITS. A period that started over a month ago restarts
-- now, with this message as its first. False when the quota is used up (nothing is counted).

create function public.consume_message(p_project_id uuid, p_limit integer)
  returns boolean
  language sql
  security invoker
  set search_path = ''
as $$
  with counted as (
    update public.projects p
      set messages_used = case
            when p.period_start < now() - interval '1 month' then 1
            else p.messages_used + 1
          end,
          period_start = case
            when p.period_start < now() - interval '1 month' then now()
            else p.period_start
          end
      where p.id = p_project_id
        and (p.period_start < now() - interval '1 month' or p.messages_used < p_limit)
      returning 1
  )
  select exists (select 1 from counted)
$$;

-- save_chat_turn -------------------------------------------------------------
-- Saves the visitor's message and the bot's reply, creating the conversation when
-- p_conversation_id is null. Returns the conversation id.
-- Raises 'conversation_not_found' (SQLSTATE P0001), saving nothing, when a given id isn't a
-- conversation of this project.

create function public.save_chat_turn(
  p_project_id uuid,
  p_conversation_id uuid,
  p_visitor_id text,
  p_visitor_body text,
  p_bot_body text
)
  returns uuid
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_at timestamptz := clock_timestamp();
begin
  if p_conversation_id is null then
    insert into public.conversations (project_id, visitor_id)
      values (p_project_id, p_visitor_id)
      returning id into v_conversation_id;
  else
    select c.id into v_conversation_id
      from public.conversations c
      where c.id = p_conversation_id and c.project_id = p_project_id;
    if v_conversation_id is null then
      raise exception 'conversation_not_found' using errcode = 'P0001';
    end if;
  end if;

  -- Messages are listed by created_at, so the reply must sort after the question.
  insert into public.messages (conversation_id, role, body, created_at)
    values
      (v_conversation_id, 'visitor', p_visitor_body, v_at),
      (v_conversation_id, 'bot', p_bot_body, v_at + interval '1 microsecond');

  return v_conversation_id;
end;
$$;

-- match_chunks ---------------------------------------------------------------
-- The p_count chunks closest to p_embedding (cosine), from this project's 'ready' sources only.
-- strict_order makes the HNSW scan keep going until enough rows pass the project filter;
-- without it, a small project among many can get fewer matches than exist, or none.

create function public.match_chunks(p_project_id uuid, p_embedding extensions.vector, p_count integer)
  returns table (content text, similarity double precision)
  language sql
  stable
  security invoker
  set search_path = ''
  set hnsw.iterative_scan = strict_order
as $$
  select c.content, 1 - (c.embedding operator(extensions.<=>) p_embedding) as similarity
    from public.knowledge_chunks c
    join public.knowledge_sources s on s.id = c.source_id and s.project_id = c.project_id
    where c.project_id = p_project_id and s.status = 'ready'
    order by c.embedding operator(extensions.<=>) p_embedding
    limit p_count
$$;

-- Grants ---------------------------------------------------------------------

revoke execute on function
  public.reserve_knowledge_source(uuid, text, text, text, text, integer),
  public.claim_knowledge_source(uuid, uuid),
  public.consume_message(uuid, integer),
  public.save_chat_turn(uuid, uuid, text, text, text),
  public.match_chunks(uuid, extensions.vector, integer)
  from public, anon, authenticated;

grant execute on function
  public.reserve_knowledge_source(uuid, text, text, text, text, integer),
  public.claim_knowledge_source(uuid, uuid),
  public.consume_message(uuid, integer),
  public.save_chat_turn(uuid, uuid, text, text, text),
  public.match_chunks(uuid, extensions.vector, integer)
  to service_role;
