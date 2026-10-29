// Test database: pglite with Supabase's roles, grants and auth.jwt() stubbed.
// Every migration, policy and function test runs on this (never a local Supabase stack).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";

export type SupabaseRole = "anon" | "authenticated" | "service_role";
export type JwtClaims = Record<string, unknown>;

const ROLES: readonly SupabaseRole[] = ["anon", "authenticated", "service_role"];

const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL("../../supabase/migrations", import.meta.url));

// What a fresh Supabase project has before any migration runs.
const SUPABASE_BOOTSTRAP = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema extensions;
  create schema auth;
  grant usage on schema extensions, auth to anon, authenticated, service_role;

  -- Same as Supabase: claims come from the request's JWT, set per transaction.
  create function auth.jwt() returns jsonb
    language sql stable
    as $$
      select coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
      )::jsonb
    $$;

  -- Supabase's default grants on public: API roles get everything unless a migration revokes it.
  grant usage, create on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
  grant all on all functions in schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

  set search_path = "$user", public, extensions;
`;

export type CreateTestDbOptions = {
  /** Defaults to the repo's `supabase/migrations`. */
  migrationsDir?: string;
};

/** Boots pglite with pgvector and Supabase's roles, then applies every migration in filename order. */
export async function createTestDb({
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
}: CreateTestDbOptions = {}) {
  const db = await PGlite.create({ extensions: { vector } });
  await db.exec(SUPABASE_BOOTSTRAP);

  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(
        `Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          cause: error,
        },
      );
    }
  }

  return db;
}

/**
 * Runs `fn` in a transaction as `role`, with `claims` as the JWT (`role` is added if missing).
 * Role and claims are transaction-local, so they reset afterwards. Query through `tx`, not `db`.
 */
export async function asRole<T>(
  db: PGlite,
  role: SupabaseRole,
  claims: JwtClaims | undefined,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  if (!ROLES.includes(role)) throw new Error(`Unknown role: ${String(role)}`);
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ role, ...claims }),
    ]);
    return fn(tx);
  });
}
