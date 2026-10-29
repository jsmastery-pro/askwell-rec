import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_WIDGET_CONFIG,
  KNOWLEDGE_SOURCE_STATUSES,
  KNOWLEDGE_SOURCE_TYPES,
  MESSAGE_ROLES,
  PLANS,
  WIDGET_ANIMATIONS,
  WIDGET_POSITIONS,
} from "../../shared/src";
import { asRole, createTestDb, type SupabaseRole } from "../supabase-pglite";

// Tests for the init_schema migration: RLS, grants, helpers, cascades, and drift against packages/shared.

const TABLES = [
  "accounts",
  "projects",
  "widget_configs",
  "knowledge_sources",
  "knowledge_chunks",
  "conversations",
  "messages",
] as const;
type Table = (typeof TABLES)[number];

// The column that identifies a seeded row in each table.
const KEY: Record<Table, string> = {
  accounts: "clerk_user_id",
  projects: "id",
  widget_configs: "project_id",
  knowledge_sources: "id",
  knowledge_chunks: "id",
  conversations: "id",
  messages: "id",
};

const EMBEDDING = `array_fill(0.1::real, array[1536])::extensions.vector`;

// One row per table per user. Ids end in the user letter.
const ids = (u: string) => ({
  accounts: `user_${u}`,
  projects: `00000000-0000-4000-8000-00000000001${u}`,
  widget_configs: `00000000-0000-4000-8000-00000000001${u}`,
  knowledge_sources: `00000000-0000-4000-8000-00000000002${u}`,
  knowledge_chunks: `00000000-0000-4000-8000-00000000003${u}`,
  conversations: `00000000-0000-4000-8000-00000000004${u}`,
  messages: `00000000-0000-4000-8000-00000000005${u}`,
});
const A = ids("a");
const B = ids("b");
const C = ids("c");

function seedSql(u: ReturnType<typeof ids>, tag: string) {
  return `
    insert into public.accounts (clerk_user_id) values ('${u.accounts}');
    insert into public.projects (id, owner_id, name, public_key)
      values ('${u.projects}', '${u.accounts}', 'Project ${tag}', 'pk_test_${tag}');
    insert into public.widget_configs (project_id) values ('${u.projects}');
    insert into public.knowledge_sources (id, project_id, title, type, storage_key, status)
      values ('${u.knowledge_sources}', '${u.projects}', 'Guide', 'pdf', '${u.projects}/guide.pdf', 'ready');
    insert into public.knowledge_chunks (id, project_id, source_id, content, embedding)
      values ('${u.knowledge_chunks}', '${u.projects}', '${u.knowledge_sources}', 'chunk', ${EMBEDDING});
    insert into public.conversations (id, project_id, visitor_id)
      values ('${u.conversations}', '${u.projects}', 'visitor_${tag}');
    insert into public.messages (id, conversation_id, role, body)
      values ('${u.messages}', '${u.conversations}', 'visitor', 'hi');
  `;
}

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
  await db.exec(seedSql(A, "a") + seedSql(B, "b"));
});

afterEach(async () => {
  await db.close();
});

const asA = <T>(fn: Parameters<typeof asRole<T>>[3]) =>
  asRole(db, "authenticated", { sub: "user_a" }, fn);

async function count(sql: string, params: unknown[] = []) {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from (${sql}) t`,
    params,
  );
  return rows[0]?.n;
}

describe("tenant isolation", () => {
  it.each(TABLES)("A sees only A's row in %s; B's returns 0", async (table) => {
    const keys = await asA(async (tx) => {
      const { rows } = await tx.query<{ k: string }>(
        `select ${KEY[table]}::text as k from public.${table}`,
      );
      return rows.map((r) => r.k);
    });
    expect(keys).toEqual([A[table]]);

    const bRows = await asA(
      async (tx) =>
        (await tx.query(`select 1 from public.${table} where ${KEY[table]}::text = $1`, [B[table]]))
          .rows,
    );
    expect(bRows).toEqual([]);
  });

  it("an authenticated user with no account sees nothing", async () => {
    for (const table of TABLES) {
      const rows = await asRole(
        db,
        "authenticated",
        { sub: "user_c" },
        async (tx) => (await tx.query(`select 1 from public.${table}`)).rows,
      );
      expect(rows, table).toEqual([]);
    }
  });
});

describe("anon", () => {
  it.each(TABLES)("gets a permission error on %s", async (table) => {
    await expect(
      asRole(db, "anon", undefined, (tx) => tx.query(`select * from public.${table}`)),
    ).rejects.toThrow(/permission denied/);
  });

  it.each(["owned_project_ids", "owned_conversation_ids"])("can't execute %s", async (fn) => {
    await expect(
      asRole(db, "anon", undefined, (tx) => tx.query(`select public.${fn}()`)),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("authenticated writes", () => {
  it.each(TABLES)("can't INSERT into %s", async (table) => {
    await expect(
      asA((tx) => tx.query(`insert into public.${table} default values`)),
    ).rejects.toThrow(/permission denied/);
  });

  it.each(TABLES.filter((t) => t !== "projects"))("can't UPDATE %s", async (table) => {
    await expect(
      asA((tx) => tx.query(`update public.${table} set ${KEY[table]} = ${KEY[table]}`)),
    ).rejects.toThrow(/permission denied/);
  });

  it.each(TABLES.filter((t) => t !== "projects"))("can't DELETE from %s", async (table) => {
    await expect(asA((tx) => tx.query(`delete from public.${table}`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("A can rename A's project", async () => {
    const { affectedRows } = await asA((tx) =>
      tx.query("update public.projects set name = 'Renamed' where id = $1", [A.projects]),
    );
    expect(affectedRows).toBe(1);
    expect(
      await count("select 1 from public.projects where name = 'Renamed' and id = $1", [A.projects]),
    ).toBe(1);
  });

  it.each([
    ["messages_used", "0"],
    ["public_key", "'pk_stolen'"],
    ["owner_id", "'user_b'"],
  ])("A can't change %s on A's project", async (column, value) => {
    await expect(
      asA((tx) =>
        tx.query(`update public.projects set ${column} = ${value} where id = $1`, [A.projects]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("A can't rename B's project", async () => {
    const { affectedRows } = await asA((tx) =>
      tx.query("update public.projects set name = 'Hijacked' where id = $1", [B.projects]),
    );
    expect(affectedRows).toBe(0);
    expect(
      await count("select 1 from public.projects where name = 'Project b' and id = $1", [
        B.projects,
      ]),
    ).toBe(1);
  });

  it("A can't delete B's project", async () => {
    const { affectedRows } = await asA((tx) =>
      tx.query("delete from public.projects where id = $1", [B.projects]),
    );
    expect(affectedRows).toBe(0);
    expect(await count("select 1 from public.projects where id = $1", [B.projects])).toBe(1);
  });

  it("A deleting A's project cascades to config, sources, chunks, conversations and messages", async () => {
    const { affectedRows } = await asA((tx) =>
      tx.query("delete from public.projects where id = $1", [A.projects]),
    );
    expect(affectedRows).toBe(1);

    for (const table of TABLES.filter((t) => t !== "accounts")) {
      expect(
        await count(`select 1 from public.${table} where ${KEY[table]}::text = $1`, [A[table]]),
        table,
      ).toBe(0);
      expect(
        await count(`select 1 from public.${table} where ${KEY[table]}::text = $1`, [B[table]]),
        table,
      ).toBe(1);
    }
  });
});

describe("service_role", () => {
  it("can read and write every table", async () => {
    await asRole(db, "service_role", undefined, async (tx) => {
      for (const table of TABLES) {
        const { rows } = await tx.query(`select * from public.${table}`);
        expect(rows, table).toHaveLength(2);
      }
      await tx.exec(seedSql(C, "c"));
      for (const table of TABLES) {
        const { rows } = await tx.query(`select * from public.${table}`);
        expect(rows, table).toHaveLength(3);
      }
      await tx.exec(`
        update public.accounts set plan = 'pro' where clerk_user_id = 'user_c';
        update public.projects set messages_used = 5 where owner_id = 'user_c';
        update public.widget_configs set position = 'top-left' where project_id = '${C.projects}';
        update public.knowledge_sources set status = 'failed' where id = '${C.knowledge_sources}';
        update public.knowledge_chunks set content = 'x' where id = '${C.knowledge_chunks}';
        update public.conversations set visitor_id = 'v' where id = '${C.conversations}';
        update public.messages set body = 'x' where id = '${C.messages}';
        delete from public.accounts where clerk_user_id = 'user_c';
      `);
      for (const table of TABLES) {
        const { rows } = await tx.query(`select * from public.${table}`);
        expect(rows, table).toHaveLength(2);
      }
    });
  });

  it("bypasses RLS without JWT claims", async () => {
    const n = await asRole(db, "service_role", undefined, async (tx) => {
      const { rows } = await tx.query<{ n: number }>(
        "select count(*)::int as n from public.projects",
      );
      return rows[0]?.n;
    });
    expect(n).toBe(2);
  });
});

describe("catalog", () => {
  it("every table in public has RLS on, and these are exactly the §7 tables", async () => {
    const { rows } = await db.query<{ relname: string; rls: boolean }>(
      `select c.relname, c.relrowsecurity as rls from pg_class c
       where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') order by c.relname`,
    );
    expect(rows.map((r) => r.relname)).toEqual([...TABLES].sort());
    expect(rows.filter((r) => !r.rls)).toEqual([]);
  });

  it("both helpers are SECURITY DEFINER, stable, with search_path = ''", async () => {
    const { rows } = await db.query<{
      proname: string;
      proconfig: string[];
      prosecdef: boolean;
      provolatile: string;
    }>(
      `select proname, proconfig, prosecdef, provolatile from pg_proc
       where pronamespace = 'public'::regnamespace and proname in ('owned_project_ids', 'owned_conversation_ids')
       order by proname`,
    );
    expect(rows).toEqual([
      {
        proname: "owned_conversation_ids",
        proconfig: ['search_path=""'],
        prosecdef: true,
        provolatile: "s",
      },
      {
        proname: "owned_project_ids",
        proconfig: ['search_path=""'],
        prosecdef: true,
        provolatile: "s",
      },
    ]);
  });

  it("helpers are executable only by authenticated", async () => {
    for (const fn of ["public.owned_project_ids()", "public.owned_conversation_ids()"]) {
      const { rows } = await db.query<Record<SupabaseRole | "public", boolean>>(
        `select has_function_privilege('anon', $1, 'execute') as anon,
                has_function_privilege('authenticated', $1, 'execute') as authenticated,
                has_function_privilege('service_role', $1, 'execute') as service_role,
                exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                        where p.oid = $1::regprocedure and a.grantee = 0) as public`,
        [fn],
      );
      expect(rows[0], fn).toEqual({
        anon: false,
        authenticated: true,
        service_role: false,
        public: false,
      });
    }
  });

  it("no API role can TRUNCATE any table", async () => {
    for (const table of TABLES) {
      for (const role of ["anon", "authenticated", "service_role"]) {
        const { rows } = await db.query<{ ok: boolean }>(
          "select has_table_privilege($1, $2, 'truncate') as ok",
          [role, `public.${table}`],
        );
        expect(rows[0]?.ok, `${role} on ${table}`).toBe(false);
      }
    }
  });

  it("every foreign key has an index leading with its columns", async () => {
    const { rows } = await db.query<{ conname: string }>(
      `select con.conname from pg_constraint con
       where con.contype = 'f' and con.connamespace = 'public'::regnamespace
         and not exists (
           select 1 from pg_index i
           where i.indrelid = con.conrelid
             and (i.indkey::int2[])[0:cardinality(con.conkey) - 1] = con.conkey
         )`,
    );
    expect(rows).toEqual([]);
  });

  it("knowledge_chunks.embedding has an HNSW cosine index", async () => {
    const { rows } = await db.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname = 'public' and tablename = 'knowledge_chunks'",
    );
    expect(
      rows.some((r) => /using hnsw \(embedding (extensions\.)?vector_cosine_ops\)/i.test(r.indexdef)),
    ).toBe(true);
  });
});

describe("matches packages/shared", () => {
  async function checkValues(constraint: string) {
    const { rows } = await db.query<{ def: string }>(
      "select pg_get_constraintdef(oid) as def from pg_constraint where conname = $1 and connamespace = 'public'::regnamespace",
      [constraint],
    );
    const def = rows[0]?.def;
    if (!def) throw new Error(`No constraint ${constraint}`);
    return [...def.matchAll(/'([^']*)'::text/g)].map((m) => m[1]);
  }

  it.each([
    ["accounts_plan_check", PLANS],
    ["widget_configs_position_check", WIDGET_POSITIONS],
    ["widget_configs_animation_check", WIDGET_ANIMATIONS],
    ["knowledge_sources_type_check", KNOWLEDGE_SOURCE_TYPES],
    ["knowledge_sources_status_check", KNOWLEDGE_SOURCE_STATUSES],
    ["messages_role_check", MESSAGE_ROLES],
  ] as const)("%s allows exactly the shared values", async (constraint, values) => {
    expect(await checkValues(constraint)).toEqual([...values]);
  });

  it("widget_configs defaults equal DEFAULT_WIDGET_CONFIG", async () => {
    const { rows } = await db.query(
      `select button_color as "buttonColor", position, label, animation, header_text as "headerText",
              show_badge as "showBadge"
       from public.widget_configs where project_id = $1`,
      [A.projects],
    );
    expect(rows[0]).toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("period_start defaults to the start of the current UTC month", async () => {
    const { rows } = await db.query<{ ok: boolean }>(
      `select period_start = date_trunc('month', now() at time zone 'utc') at time zone 'utc' as ok
       from public.projects where id = $1`,
      [A.projects],
    );
    expect(rows[0]?.ok).toBe(true);
  });
});
