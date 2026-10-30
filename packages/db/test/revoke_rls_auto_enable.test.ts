import { copyFile, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { asRole, createTestDb } from "../supabase-pglite";

// Tests for the revoke_rls_auto_enable migration: it must work whether or not Supabase's
// "automatic RLS" setting created public.rls_auto_enable(), and keep auto-RLS working.

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../supabase/migrations", import.meta.url));
const FN = "public.rls_auto_enable()";

// A stand-in for what the Supabase setting creates (same shape as on dev): a SECURITY DEFINER
// event trigger function, executable by every API role through the default grants on public.
const STAND_IN = `
  create function public.rls_auto_enable()
    returns event_trigger
    language plpgsql
    security definer
    set search_path = pg_catalog
  as $$
  declare
    cmd record;
  begin
    for cmd in
      select * from pg_event_trigger_ddl_commands()
      where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
        and object_type in ('table', 'partitioned table')
        and schema_name = 'public'
    loop
      execute format('alter table if exists %s enable row level security', cmd.object_identity);
    end loop;
  end;
  $$;

  create event trigger ensure_rls on ddl_command_end
    when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
    execute function public.rls_auto_enable();
`;

/** The repo's migrations, plus a stand-in file that sorts before all of them. */
async function migrationsWithStandIn() {
  const dir = await mkdtemp(join(tmpdir(), "askwell-migrations-"));
  for (const file of await readdir(MIGRATIONS_DIR)) {
    if (file.endsWith(".sql")) await copyFile(join(MIGRATIONS_DIR, file), join(dir, file));
  }
  await writeFile(join(dir, "00000000000000_supabase_rls_auto_enable.sql"), STAND_IN);
  return dir;
}

async function canExecute(db: PGlite) {
  const { rows } = await db.query<Record<string, boolean>>(
    `select has_function_privilege('anon', $1, 'execute') as anon,
            has_function_privilege('authenticated', $1, 'execute') as authenticated,
            exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                    where p.oid = $1::regprocedure and a.grantee = 0) as public`,
    [FN],
  );
  return rows[0];
}

let db: PGlite | undefined;
let dir: string | undefined;

afterEach(async () => {
  await db?.close();
  if (dir) await rm(dir, { recursive: true });
  db = undefined;
  dir = undefined;
});

describe("revoke_rls_auto_enable", () => {
  it("applies cleanly when rls_auto_enable() doesn't exist", async () => {
    db = await createTestDb();
    const { rows } = await db.query("select 1 from pg_proc where proname = 'rls_auto_enable'");
    expect(rows).toEqual([]);
  });

  it("the stand-in starts executable by anon and authenticated (like dev)", async () => {
    // Guard for the next test: without the revoke, the default grants would allow it.
    dir = await migrationsWithStandIn();
    for (const file of await readdir(dir)) {
      if (file.endsWith("_revoke_rls_auto_enable.sql")) await rm(join(dir, file));
    }
    db = await createTestDb({ migrationsDir: dir });
    expect(await canExecute(db)).toEqual({ anon: true, authenticated: true, public: true });
  });

  it("when rls_auto_enable() exists, anon, authenticated and PUBLIC lose EXECUTE", async () => {
    dir = await migrationsWithStandIn();
    db = await createTestDb({ migrationsDir: dir });
    expect(await canExecute(db)).toEqual({ anon: false, authenticated: false, public: false });
  });

  it("keeps the function and its event trigger, and auto-RLS still fires", async () => {
    dir = await migrationsWithStandIn();
    db = await createTestDb({ migrationsDir: dir });

    const trigger = await db.query<{ evtname: string; evtenabled: string; prosecdef: boolean }>(
      `select e.evtname, e.evtenabled, p.prosecdef from pg_event_trigger e
       join pg_proc p on p.oid = e.evtfoid where p.oid = $1::regprocedure`,
      [FN],
    );
    expect(trigger.rows).toEqual([{ evtname: "ensure_rls", evtenabled: "O", prosecdef: true }]);

    // A role that has just lost EXECUTE creates a table: the trigger still enables RLS.
    await asRole(db, "authenticated", undefined, (tx) =>
      tx.exec("create table public.auto_rls_check (id int)"),
    );
    const { rows } = await db.query<{ rls: boolean }>(
      "select relrowsecurity as rls from pg_class where oid = 'public.auto_rls_check'::regclass",
    );
    expect(rows).toEqual([{ rls: true }]);
  });
});
