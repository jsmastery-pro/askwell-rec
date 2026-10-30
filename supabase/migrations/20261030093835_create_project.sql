-- create_project: the project limit enforced inside Postgres (project.md §7), and everything a
-- new project needs in one call. The owner's account row is locked while counting, so two
-- parallel calls for the same owner can't both pass the limit. Only service_role may execute it.

-- Already installed in `extensions` on Supabase; needed for gen_random_bytes.
create extension if not exists pgcrypto with schema extensions;

-- p_project_limits: projects allowed per plan, e.g. {"free": 1, "pro": 5}, built from PLAN_LIMITS.
-- The plan is read here, never taken as an argument.
-- Raises 'limit_reached' (SQLSTATE P0001) when the owner already has their plan's limit.
create function public.create_project(p_owner_id text, p_name text, p_project_limits jsonb)
  returns public.projects
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
  v_project public.projects;
  v_constraint text;
  v_attempt integer := 0;
begin
  -- An owner can call the API before ever opening the dashboard.
  insert into public.accounts (clerk_user_id) values (p_owner_id) on conflict do nothing;

  select a.plan into v_plan
    from public.accounts a
    where a.clerk_user_id = p_owner_id
    for update;

  v_limit := (p_project_limits ->> v_plan)::integer;
  if v_limit is null then
    raise exception 'create_project: no project limit for plan %', v_plan;
  end if;

  select count(*) into v_count from public.projects p where p.owner_id = p_owner_id;
  if v_count >= v_limit then
    raise exception 'limit_reached' using errcode = 'P0001';
  end if;

  -- 24 random bytes → 32 url-safe base64 chars. Retry on the rare public_key collision.
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.projects (owner_id, name, public_key)
        values (
          p_owner_id,
          p_name,
          'pk_' || translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_')
        )
        returning * into v_project;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'projects_public_key_key' or v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  -- Column defaults are DEFAULT_WIDGET_CONFIG.
  insert into public.widget_configs (project_id) values (v_project.id);

  return v_project;
end;
$$;

revoke execute on function public.create_project(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_project(text, text, jsonb) to service_role;
