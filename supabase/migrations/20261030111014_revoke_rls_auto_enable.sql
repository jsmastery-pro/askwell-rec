-- Supabase's "automatic RLS" setting creates public.rls_auto_enable(), an event trigger function
-- that is SECURITY DEFINER and, through the default grants on public, executable by anon and
-- authenticated (project.md §9: no API role gets a function it doesn't need). Not every project
-- has it, so revoke only if it exists. The function and its event trigger are left as they are:
-- an event trigger fires without the DDL user holding EXECUTE, so auto-RLS keeps working.

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable' and p.pronargs = 0
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
