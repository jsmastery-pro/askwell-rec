import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, createTestDb } from "../supabase-pglite";

async function tempMigrationsDir(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), "askwell-migrations-"));
  for (const [name, sql] of Object.entries(files)) await writeFile(join(dir, name), sql);
  return dir;
}

describe("createTestDb", () => {
  it("boots with zero migrations", async () => {
    const dir = await tempMigrationsDir({});
    try {
      const db = await createTestDb({ migrationsDir: dir });
      const { rows } = await db.query<{ ok: number }>("select 1 as ok");
      expect(rows).toEqual([{ ok: 1 }]);
      await db.close();
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("boots with the repo's migrations", async () => {
    const db = await createTestDb();
    await db.close();
  });

  it("applies migrations in filename order, skipping non-.sql files", async () => {
    const dir = await tempMigrationsDir({
      // Written out of order: 2 depends on 1.
      "20260102000000_second.sql": "insert into public.applied (name) values ('second');",
      "20260101000000_first.sql": "create table public.applied (id serial primary key, name text);",
      "README.md": "not sql",
    });
    try {
      const db = await createTestDb({ migrationsDir: dir });
      const { rows } = await db.query<{ name: string }>(
        "select name from public.applied order by id",
      );
      expect(rows.map((r) => r.name)).toEqual(["second"]);
      await db.close();
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("names the failing migration", async () => {
    const dir = await tempMigrationsDir({ "20260101000000_broken.sql": "select from nowhere;" });
    try {
      await expect(createTestDb({ migrationsDir: dir })).rejects.toThrow(
        "20260101000000_broken.sql",
      );
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

describe("Supabase stubs", () => {
  let db: PGlite;
  let dir: string;

  beforeAll(async () => {
    dir = await tempMigrationsDir({
      "20260101000000_notes.sql": `
        create table public.notes (id serial primary key, owner_id text not null, body text);
        alter table public.notes enable row level security;
        create policy "owner reads own notes" on public.notes
          for select to authenticated using (owner_id = auth.jwt()->>'sub');
        insert into public.notes (owner_id, body) values ('user_a', 'a'), ('user_b', 'b');
      `,
    });
    db = await createTestDb({ migrationsDir: dir });
  });

  afterAll(async () => {
    await db.close();
    await rm(dir, { recursive: true });
  });

  it("asRole switches role, auth.jwt()->>'sub' returns the claim, and both reset afterwards", async () => {
    const inside = await asRole(db, "authenticated", { sub: "user_a" }, async (tx) => {
      const { rows } = await tx.query<{ role: string; sub: string }>(
        "select current_user as role, auth.jwt()->>'sub' as sub",
      );
      return rows[0];
    });
    expect(inside).toEqual({ role: "authenticated", sub: "user_a" });

    const { rows } = await db.query<{ role: string; jwt: unknown }>(
      "select current_user as role, auth.jwt() as jwt",
    );
    expect(rows[0]).toEqual({ role: "postgres", jwt: null });
  });

  it("a table with RLS on and no anon policy is invisible to anon", async () => {
    const rows = await asRole(
      db,
      "anon",
      undefined,
      async (tx) => (await tx.query("select * from public.notes")).rows,
    );
    expect(rows).toEqual([]);
  });

  it("RLS scopes authenticated reads to the JWT's sub", async () => {
    const bodies = await asRole(db, "authenticated", { sub: "user_b" }, async (tx) => {
      const { rows } = await tx.query<{ body: string }>("select body from public.notes");
      return rows.map((r) => r.body);
    });
    expect(bodies).toEqual(["b"]);
  });

  it("service_role bypasses RLS", async () => {
    const count = await asRole(db, "service_role", undefined, async (tx) => {
      const { rows } = await tx.query<{ n: number }>("select count(*)::int as n from public.notes");
      return rows[0]?.n;
    });
    expect(count).toBe(2);
  });

  it("API roles get default table grants on public, like Supabase", async () => {
    const { rows } = await db.query<{ ok: boolean }>(
      "select has_table_privilege('anon', 'public.notes', 'insert') as ok",
    );
    expect(rows[0]?.ok).toBe(true);
  });

  it("pgvector installs into the extensions schema", async () => {
    await db.exec("create extension if not exists vector with schema extensions");
    const { rows } = await db.query<{ d: number }>(
      "select ('[1,2,3]'::extensions.vector <-> '[1,2,4]'::extensions.vector) as d",
    );
    expect(rows[0]?.d).toBe(1);
  });
});
