-- Initial schema: the 7 tables of project.md §7, with RLS, grants and the RLS helpers.
-- The Data API is public, so these policies and grants are the security boundary.
-- Enum values must match packages/shared (PLANS, WIDGET_POSITIONS, WIDGET_ANIMATIONS,
-- KNOWLEDGE_SOURCE_TYPES, KNOWLEDGE_SOURCE_STATUSES, MESSAGE_ROLES) and the widget_configs
-- defaults must match DEFAULT_WIDGET_CONFIG. packages/db/test checks both.

create extension if not exists vector with schema extensions;

-- Tables ---------------------------------------------------------------------

create table public.accounts (
  clerk_user_id text primary key,
  plan text not null default 'free' constraint accounts_plan_check check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.accounts (clerk_user_id) on delete cascade,
  name text not null,
  public_key text not null constraint projects_public_key_key unique,
  messages_used integer not null default 0 constraint projects_messages_used_check check (messages_used >= 0),
  period_start timestamptz not null default (date_trunc('month', now() at time zone 'utc') at time zone 'utc'),
  created_at timestamptz not null default now()
);
create index projects_owner_id_idx on public.projects (owner_id);

create table public.widget_configs (
  project_id uuid primary key references public.projects (id) on delete cascade,
  button_color text not null default '#000000'
    constraint widget_configs_button_color_check check (button_color ~ '^#[0-9a-fA-F]{6}$'),
  position text not null default 'bottom-right'
    constraint widget_configs_position_check
    check (position in ('bottom-right', 'bottom-left', 'top-right', 'top-left')),
  label text not null default 'Chat with us',
  animation text not null default 'fade'
    constraint widget_configs_animation_check check (animation in ('fade', 'slide', 'scale')),
  header_text text not null default 'How can we help?',
  show_badge boolean not null default true
);

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  type text not null constraint knowledge_sources_type_check check (type in ('text', 'pdf', 'md', 'txt')),
  -- null for pasted text, set for files
  storage_key text,
  status text not null
    constraint knowledge_sources_status_check check (status in ('uploading', 'processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  constraint knowledge_sources_storage_key_check check ((type = 'text') = (storage_key is null)),
  -- target of knowledge_chunks' (source_id, project_id) foreign key
  constraint knowledge_sources_id_project_id_key unique (id, project_id)
);
create index knowledge_sources_project_id_idx on public.knowledge_sources (project_id);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_id uuid not null,
  content text not null,
  embedding extensions.vector(1536) not null,
  -- a chunk always belongs to its source's project
  constraint knowledge_chunks_source_fkey foreign key (source_id, project_id)
    references public.knowledge_sources (id, project_id) on delete cascade
);
create index knowledge_chunks_project_id_idx on public.knowledge_chunks (project_id);
create index knowledge_chunks_source_id_idx on public.knowledge_chunks (source_id, project_id);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now()
);
create index conversations_project_id_idx on public.conversations (project_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null constraint messages_role_check check (role in ('visitor', 'bot')),
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_conversation_id_idx on public.messages (conversation_id, created_at);

-- RLS helpers ----------------------------------------------------------------
-- SECURITY DEFINER so policies can look up ownership without recursing through RLS.

create function public.owned_project_ids()
  returns setof uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.id from public.projects p where p.owner_id = (select auth.jwt() ->> 'sub')
$$;

create function public.owned_conversation_ids()
  returns setof uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select c.id from public.conversations c where c.project_id in (select public.owned_project_ids())
$$;

revoke execute on function public.owned_project_ids() from public, anon, service_role;
revoke execute on function public.owned_conversation_ids() from public, anon, service_role;
grant execute on function public.owned_project_ids() to authenticated;
grant execute on function public.owned_conversation_ids() to authenticated;

-- RLS ------------------------------------------------------------------------

alter table public.accounts enable row level security;
alter table public.projects enable row level security;
alter table public.widget_configs enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "accounts: owner reads own" on public.accounts
  for select to authenticated using (clerk_user_id = (select auth.jwt() ->> 'sub'));

create policy "projects: owner reads own" on public.projects
  for select to authenticated using (id in (select public.owned_project_ids()));
create policy "projects: owner renames own" on public.projects
  for update to authenticated
  using (id in (select public.owned_project_ids()))
  with check (id in (select public.owned_project_ids()));
create policy "projects: owner deletes own" on public.projects
  for delete to authenticated using (id in (select public.owned_project_ids()));

create policy "widget_configs: owner reads own" on public.widget_configs
  for select to authenticated using (project_id in (select public.owned_project_ids()));

create policy "knowledge_sources: owner reads own" on public.knowledge_sources
  for select to authenticated using (project_id in (select public.owned_project_ids()));

create policy "knowledge_chunks: owner reads own" on public.knowledge_chunks
  for select to authenticated using (project_id in (select public.owned_project_ids()));

create policy "conversations: owner reads own" on public.conversations
  for select to authenticated using (project_id in (select public.owned_project_ids()));

create policy "messages: owner reads own" on public.messages
  for select to authenticated using (conversation_id in (select public.owned_conversation_ids()));

-- Grants ---------------------------------------------------------------------
-- Supabase grants everything on public to anon and authenticated by default. Take it all
-- back, then grant only what §7 allows. service_role keeps full access, minus TRUNCATE.

revoke all on table
  public.accounts, public.projects, public.widget_configs, public.knowledge_sources,
  public.knowledge_chunks, public.conversations, public.messages
  from anon, authenticated;

revoke truncate on table
  public.accounts, public.projects, public.widget_configs, public.knowledge_sources,
  public.knowledge_chunks, public.conversations, public.messages
  from service_role;

grant select on table
  public.accounts, public.projects, public.widget_configs, public.knowledge_sources,
  public.knowledge_chunks, public.conversations, public.messages
  to authenticated;

grant update (name) on table public.projects to authenticated;
grant delete on table public.projects to authenticated;
