import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KNOWLEDGE_FILE_MIME_TYPES, MAX_KNOWLEDGE_FILE_BYTES, PLAN_LIMITS } from "../../shared/src";
import { asRole, createTestDb, type SupabaseRole } from "../supabase-pglite";

// Tests for the knowledge_chat_functions migration: the knowledge bucket, reserve/claim of
// knowledge sources, the monthly message quota, saving chat turns, chunk search and grants.

const FUNCTIONS = {
  reserve_knowledge_source:
    "public.reserve_knowledge_source(uuid, text, text, text, text, integer)",
  claim_knowledge_source: "public.claim_knowledge_source(uuid, uuid)",
  consume_message: "public.consume_message(uuid, integer)",
  save_chat_turn: "public.save_chat_turn(uuid, uuid, text, text, text)",
  match_chunks: "public.match_chunks(uuid, extensions.vector, integer)",
} as const;

const SOURCE_LIMIT = PLAN_LIMITS.free.knowledgeSourcesPerProject;
const MESSAGE_LIMIT = PLAN_LIMITS.free.messagesPerMonthPerProject;

type SourceRow = {
  id: string;
  project_id: string;
  title: string;
  type: string;
  storage_key: string | null;
  status: string;
};

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

// One call per transaction, like one API request each.
const asService = <T>(fn: (tx: Transaction) => Promise<T>) =>
  asRole(db, "service_role", undefined, fn);

let seq = 0;
async function seedProject() {
  seq += 1;
  const owner = `user_${seq}`;
  await db.query("insert into public.accounts (clerk_user_id) values ($1)", [owner]);
  const { rows } = await db.query<{ id: string }>(
    "insert into public.projects (owner_id, name, public_key) values ($1, 'Site', $2) returning id",
    [owner, `pk_test_${seq}`],
  );
  return rows[0]!.id;
}

async function seedSource(projectId: string, status: string, age = "0 seconds") {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.knowledge_sources (project_id, title, type, storage_key, status, created_at)
     values ($1, 'Doc', 'pdf', 'key/' || gen_random_uuid(), $2, now() - $3::interval) returning id`,
    [projectId, status, age],
  );
  return rows[0]!.id;
}

async function sourceCount(projectId: string) {
  const { rows } = await db.query<{ n: number }>(
    "select count(*)::int as n from public.knowledge_sources where project_id = $1",
    [projectId],
  );
  return rows[0]!.n;
}

async function functionSource(name: keyof typeof FUNCTIONS) {
  const { rows } = await db.query<{ src: string }>(
    "select prosrc as src from pg_proc where oid = $1::regprocedure",
    [FUNCTIONS[name]],
  );
  return rows[0]!.src.toLowerCase();
}

describe("knowledge bucket", () => {
  it("is private, capped at MAX_KNOWLEDGE_FILE_BYTES and allows KNOWLEDGE_FILE_MIME_TYPES only", async () => {
    const { rows } = await db.query(
      `select id, name, public, file_size_limit::int as file_size_limit, allowed_mime_types
       from storage.buckets`,
    );
    expect(rows).toEqual([
      {
        id: "knowledge",
        name: "knowledge",
        public: false,
        file_size_limit: MAX_KNOWLEDGE_FILE_BYTES,
        allowed_mime_types: Object.values(KNOWLEDGE_FILE_MIME_TYPES),
      },
    ]);
    expect(MAX_KNOWLEDGE_FILE_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("reserve_knowledge_source", () => {
  async function reserve(
    projectId: string,
    { type = "pdf", storageKey = "k/doc.pdf" as string | null, status = "uploading" } = {},
  ) {
    return asService(async (tx) => {
      const { rows } = await tx.query<SourceRow>(
        "select * from public.reserve_knowledge_source($1, $2, $3, $4, $5, $6)",
        [projectId, "Doc", type, storageKey, status, SOURCE_LIMIT],
      );
      return rows[0]!;
    });
  }

  it("reserves a file as uploading and returns the row", async () => {
    const projectId = await seedProject();
    const source = await reserve(projectId);
    expect(source).toMatchObject({
      project_id: projectId,
      title: "Doc",
      type: "pdf",
      storage_key: "k/doc.pdf",
      status: "uploading",
    });
    expect(await sourceCount(projectId)).toBe(1);
  });

  it("reserves pasted text as processing with a null storage key", async () => {
    const projectId = await seedProject();
    const source = await reserve(projectId, {
      type: "text",
      storageKey: null,
      status: "processing",
    });
    expect(source).toMatchObject({ type: "text", storage_key: null, status: "processing" });
  });

  it("at the limit raises limit_reached (P0001) and inserts nothing; every status counts", async () => {
    const projectId = await seedProject();
    const statuses = ["uploading", "processing", "ready", "failed"].slice(0, SOURCE_LIMIT);
    for (let i = 0; i < SOURCE_LIMIT; i++)
      await seedSource(projectId, statuses[i % statuses.length]!);

    await expect(reserve(projectId)).rejects.toMatchObject({
      message: "limit_reached",
      code: "P0001",
    });
    expect(await sourceCount(projectId)).toBe(SOURCE_LIMIT);
  });

  it("counts each project's sources separately", async () => {
    const full = await seedProject();
    const other = await seedProject();
    for (let i = 0; i < SOURCE_LIMIT; i++) await seedSource(full, "ready");

    await reserve(other);
    expect(await sourceCount(other)).toBe(1);
  });

  it("two parallel reserves for the last slot: one succeeds, one gets limit_reached", async () => {
    const projectId = await seedProject();
    for (let i = 0; i < SOURCE_LIMIT - 1; i++) await seedSource(projectId, "ready");

    const results = await Promise.allSettled([reserve(projectId), reserve(projectId)]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.reason).toMatchObject({ message: "limit_reached" });
    expect(await sourceCount(projectId)).toBe(SOURCE_LIMIT);
  });

  it("deletes this project's uploading sources older than 2 hours before counting", async () => {
    const projectId = await seedProject();
    const other = await seedProject();
    const stale = await seedSource(projectId, "uploading", "2 hours 1 minute");
    const oldProcessing = await seedSource(projectId, "processing", "3 hours");
    const fresh = await seedSource(projectId, "uploading", "1 hour 59 minutes");
    const otherStale = await seedSource(other, "uploading", "3 hours");
    expect(SOURCE_LIMIT).toBe(3);

    const source = await reserve(projectId);

    const { rows } = await db.query<{ id: string }>("select id from public.knowledge_sources");
    expect(rows.map((r) => r.id).sort()).toEqual(
      [oldProcessing, fresh, otherStale, source.id].sort(),
    );
    expect(rows.map((r) => r.id)).not.toContain(stale);
  });

  it("an uploading source under 2 hours old still counts", async () => {
    const projectId = await seedProject();
    for (let i = 0; i < SOURCE_LIMIT; i++) await seedSource(projectId, "uploading", "1 hour");
    await expect(reserve(projectId)).rejects.toMatchObject({ message: "limit_reached" });
  });

  it("rejects a status other than uploading or processing", async () => {
    const projectId = await seedProject();
    await expect(reserve(projectId, { status: "ready" })).rejects.toThrow(
      "reserve_knowledge_source: invalid status ready",
    );
    expect(await sourceCount(projectId)).toBe(0);
  });

  it("raises for an unknown project", async () => {
    await expect(reserve("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      /reserve_knowledge_source: no project/,
    );
  });

  // pglite is one connection, so the parallel test above runs the calls one after the other.
  // Guard the row lock that makes real parallel calls wait on each other.
  it("locks the project row before reclaiming and counting", async () => {
    const src = await functionSource("reserve_knowledge_source");
    const lock = src.search(/from public\.projects p where p\.id = p_project_id for update/);
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(src.indexOf("delete from public.knowledge_sources"));
    expect(lock).toBeLessThan(src.indexOf("count(*)"));
  });
});

describe("claim_knowledge_source", () => {
  async function claim(sourceId: string, projectId: string) {
    return asService(async (tx) => {
      const { rows } = await tx.query<{ claimed: boolean }>(
        "select public.claim_knowledge_source($1, $2) as claimed",
        [sourceId, projectId],
      );
      return rows[0]!.claimed;
    });
  }

  async function statusOf(sourceId: string) {
    const { rows } = await db.query<{ status: string }>(
      "select status from public.knowledge_sources where id = $1",
      [sourceId],
    );
    return rows[0]!.status;
  }

  it("claims an uploading source once: true, then false", async () => {
    const projectId = await seedProject();
    const sourceId = await seedSource(projectId, "uploading");

    expect(await claim(sourceId, projectId)).toBe(true);
    expect(await statusOf(sourceId)).toBe("processing");
    expect(await claim(sourceId, projectId)).toBe(false);
  });

  it("two parallel claims: exactly one wins", async () => {
    const projectId = await seedProject();
    const sourceId = await seedSource(projectId, "uploading");
    const results = await Promise.all([claim(sourceId, projectId), claim(sourceId, projectId)]);
    expect(results.sort()).toEqual([false, true]);
  });

  it("another project's id gets false and changes nothing", async () => {
    const projectId = await seedProject();
    const other = await seedProject();
    const sourceId = await seedSource(projectId, "uploading");

    expect(await claim(sourceId, other)).toBe(false);
    expect(await statusOf(sourceId)).toBe("uploading");
  });

  it.each(["processing", "ready", "failed"])("a %s source gets false", async (status) => {
    const projectId = await seedProject();
    const sourceId = await seedSource(projectId, status);
    expect(await claim(sourceId, projectId)).toBe(false);
    expect(await statusOf(sourceId)).toBe(status);
  });
});

describe("consume_message", () => {
  async function consume(projectId: string, limit: number = MESSAGE_LIMIT) {
    return asService(async (tx) => {
      const { rows } = await tx.query<{ counted: boolean }>(
        "select public.consume_message($1, $2) as counted",
        [projectId, limit],
      );
      return rows[0]!.counted;
    });
  }

  async function usage(projectId: string) {
    const { rows } = await db.query<{ messages_used: number; reset_now: boolean }>(
      `select messages_used, period_start > now() - interval '1 minute' as reset_now
       from public.projects where id = $1`,
      [projectId],
    );
    return rows[0]!;
  }

  async function setUsage(projectId: string, used: number, periodAge: string) {
    await db.query(
      "update public.projects set messages_used = $2, period_start = now() - $3::interval where id = $1",
      [projectId, used, periodAge],
    );
  }

  it("counts until the limit, then returns false without counting", async () => {
    const projectId = await seedProject();
    for (let i = 0; i < 3; i++) expect(await consume(projectId, 3)).toBe(true);
    expect(await consume(projectId, 3)).toBe(false);
    expect((await usage(projectId)).messages_used).toBe(3);
  });

  it("stops at the plan's limit within the current period", async () => {
    const projectId = await seedProject();
    await setUsage(projectId, MESSAGE_LIMIT - 1, "20 days");

    expect(await consume(projectId)).toBe(true);
    expect(await consume(projectId)).toBe(false);
    expect(await usage(projectId)).toEqual({ messages_used: MESSAGE_LIMIT, reset_now: false });
  });

  it("a period over a month old resets to 1 and starts now, even at the limit", async () => {
    const projectId = await seedProject();
    await setUsage(projectId, MESSAGE_LIMIT, "1 month 1 day");

    expect(await consume(projectId)).toBe(true);
    expect(await usage(projectId)).toEqual({ messages_used: 1, reset_now: true });
    expect(await consume(projectId)).toBe(true);
    expect(await usage(projectId)).toEqual({ messages_used: 2, reset_now: true });
  });

  it("counts each project separately", async () => {
    const full = await seedProject();
    const other = await seedProject();
    await setUsage(full, MESSAGE_LIMIT, "1 day");

    expect(await consume(full)).toBe(false);
    expect(await consume(other)).toBe(true);
    expect((await usage(other)).messages_used).toBe(1);
  });

  it("an unknown project returns false", async () => {
    expect(await consume("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("is one statement (no read-then-write race)", async () => {
    const src = await functionSource("consume_message");
    expect(src.match(/\bupdate public\.projects\b/g)).toHaveLength(1);
    expect(src).not.toMatch(/\bselect\b[^;]*\bmessages_used\b[^;]*\bfrom public\.projects\b/);
  });
});

describe("save_chat_turn", () => {
  async function save(projectId: string, conversationId: string | null) {
    return asService(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "select public.save_chat_turn($1, $2, $3, $4, $5) as id",
        [projectId, conversationId, "visitor_1", "Question?", "Answer."],
      );
      return rows[0]!.id;
    });
  }

  async function messagesOf(conversationId: string) {
    const { rows } = await db.query<{ role: string; body: string }>(
      "select role, body from public.messages where conversation_id = $1 order by created_at",
      [conversationId],
    );
    return rows;
  }

  async function rowCounts() {
    const { rows } = await db.query<{ conversations: number; messages: number }>(
      `select (select count(*)::int from public.conversations) as conversations,
              (select count(*)::int from public.messages) as messages`,
    );
    return rows[0]!;
  }

  it("a null id creates the conversation and saves the visitor message, then the reply", async () => {
    const projectId = await seedProject();
    const conversationId = await save(projectId, null);

    const { rows } = await db.query("select id, project_id, visitor_id from public.conversations");
    expect(rows).toEqual([{ id: conversationId, project_id: projectId, visitor_id: "visitor_1" }]);
    expect(await messagesOf(conversationId)).toEqual([
      { role: "visitor", body: "Question?" },
      { role: "bot", body: "Answer." },
    ]);
  });

  it("an existing id of this project adds the turn to it", async () => {
    const projectId = await seedProject();
    const conversationId = await save(projectId, null);

    expect(await save(projectId, conversationId)).toBe(conversationId);
    expect((await messagesOf(conversationId)).map((m) => m.role)).toEqual([
      "visitor",
      "bot",
      "visitor",
      "bot",
    ]);
    expect(await rowCounts()).toEqual({ conversations: 1, messages: 4 });
  });

  it("another project's conversation id raises conversation_not_found and saves nothing", async () => {
    const projectId = await seedProject();
    const other = await seedProject();
    const otherConversation = await save(other, null);

    await expect(save(projectId, otherConversation)).rejects.toMatchObject({
      message: "conversation_not_found",
      code: "P0001",
    });
    expect(await rowCounts()).toEqual({ conversations: 1, messages: 2 });
  });

  it("an unknown conversation id raises conversation_not_found and saves nothing", async () => {
    const projectId = await seedProject();
    await expect(save(projectId, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({
      message: "conversation_not_found",
    });
    expect(await rowCounts()).toEqual({ conversations: 0, messages: 0 });
  });
});

describe("match_chunks", () => {
  // A 1536-dim vector pointing mostly along `axis`, tilted toward axis 0 by `tilt`.
  function vec(axis: number, tilt = 0) {
    const v = new Array<number>(1536).fill(0);
    v[axis] = 1;
    v[0] = (v[0] ?? 0) + tilt;
    return `[${v.join(",")}]`;
  }

  async function seedChunk(
    projectId: string,
    sourceId: string,
    content: string,
    embedding: string,
  ) {
    await db.query(
      `insert into public.knowledge_chunks (project_id, source_id, content, embedding)
       values ($1, $2, $3, $4::extensions.vector)`,
      [projectId, sourceId, content, embedding],
    );
  }

  async function match(projectId: string, embedding: string, count = 5, tx?: Transaction) {
    const run = async (t: Transaction) => {
      const { rows } = await t.query<{ content: string; similarity: number }>(
        "select * from public.match_chunks($1, $2::extensions.vector, $3)",
        [projectId, embedding, count],
      );
      return rows;
    };
    return tx ? run(tx) : asService(run);
  }

  it("returns content and cosine similarity, closest first, at most p_count", async () => {
    const projectId = await seedProject();
    const sourceId = await seedSource(projectId, "ready");
    await seedChunk(projectId, sourceId, "exact", vec(1));
    await seedChunk(projectId, sourceId, "near", vec(1, 0.5));
    await seedChunk(projectId, sourceId, "far", vec(2));

    const rows = await match(projectId, vec(1), 2);
    expect(rows.map((r) => r.content)).toEqual(["exact", "near"]);
    expect(rows[0]!.similarity).toBeCloseTo(1, 5);
    expect(rows[1]!.similarity).toBeCloseTo(1 / Math.sqrt(1.25), 5);
  });

  it("never returns another project's chunks, even closer ones", async () => {
    const projectId = await seedProject();
    const other = await seedProject();
    const mine = await seedSource(projectId, "ready");
    const theirs = await seedSource(other, "ready");
    await seedChunk(projectId, mine, "mine", vec(2));
    await seedChunk(other, theirs, "theirs", vec(1));

    expect((await match(projectId, vec(1))).map((r) => r.content)).toEqual(["mine"]);
  });

  it("returns chunks of ready sources only", async () => {
    const projectId = await seedProject();
    for (const status of ["uploading", "processing", "ready", "failed"]) {
      await seedChunk(projectId, await seedSource(projectId, status), status, vec(1));
    }
    expect((await match(projectId, vec(1))).map((r) => r.content)).toEqual(["ready"]);
  });

  it("through the HNSW index, still finds a small project's chunks among many closer ones", async () => {
    // Seeded random vectors: the query, 200 of another project's chunks near it, 2 of ours far off.
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648 - 0.5;
    };
    const query = Array.from({ length: 1536 }, rand);
    const literal = (v: number[]) => `[${v.join(",")}]`;

    const projectId = await seedProject();
    const other = await seedProject();
    const mine = await seedSource(projectId, "ready");
    const theirs = await seedSource(other, "ready");
    for (const content of ["mine 1", "mine 2"]) {
      await seedChunk(projectId, mine, content, literal(Array.from({ length: 1536 }, rand)));
    }
    for (let i = 0; i < 200; i++) {
      await seedChunk(other, theirs, "theirs", literal(query.map((x) => x + rand() * 0.5)));
    }

    // On a big table the planner picks HNSW. Force it here: drop the btree indexes the planner
    // would otherwise use for this tiny project, and rule out scans that read every row.
    await db.exec(
      "drop index public.knowledge_chunks_project_id_idx; drop index public.knowledge_chunks_source_id_idx",
    );
    const sameQuery = `select c.content from public.knowledge_chunks c
      join public.knowledge_sources s on s.id = c.source_id and s.project_id = c.project_id
      where c.project_id = $2 and s.status = 'ready'
      order by c.embedding operator(extensions.<=>) $1::extensions.vector limit 5`;

    const { plan, withoutIterative, rows } = await asService(async (tx) => {
      await tx.exec("set local enable_seqscan = off; set local enable_bitmapscan = off");
      const explained = await tx.query<{ "QUERY PLAN": string }>(`explain ${sameQuery}`, [
        literal(query),
        projectId,
      ]);
      // The failure strict_order prevents: HNSW's first candidates are all another project's.
      await tx.exec("set local hnsw.iterative_scan = off");
      const plain = await tx.query<{ content: string }>(sameQuery, [literal(query), projectId]);
      return {
        plan: explained.rows.map((p) => p["QUERY PLAN"]).join("\n"),
        withoutIterative: plain.rows,
        rows: await match(projectId, literal(query), 5, tx),
      };
    });
    expect(plan).toMatch(/Index Scan using knowledge_chunks_embedding_idx/);
    expect(withoutIterative).toEqual([]);
    expect(rows.map((r) => r.content).sort()).toEqual(["mine 1", "mine 2"]);
  });
});

describe("grants", () => {
  const calls: Record<keyof typeof FUNCTIONS, string> = {
    reserve_knowledge_source:
      "select public.reserve_knowledge_source(gen_random_uuid(), 'Doc', 'text', null, 'processing', 3)",
    claim_knowledge_source:
      "select public.claim_knowledge_source(gen_random_uuid(), gen_random_uuid())",
    consume_message: "select public.consume_message(gen_random_uuid(), 100)",
    save_chat_turn: "select public.save_chat_turn(gen_random_uuid(), null, 'v', 'q', 'a')",
    match_chunks: `select * from public.match_chunks(gen_random_uuid(), array_fill(0.1::real, array[1536])::extensions.vector, 5)`,
  };

  for (const role of ["anon", "authenticated"] as const) {
    it.each(Object.keys(FUNCTIONS) as (keyof typeof FUNCTIONS)[])(
      `${role} gets permission denied executing %s`,
      async (name) => {
        await expect(
          asRole(db, role, { sub: "user_a" }, (tx) => tx.query(calls[name])),
        ).rejects.toThrow(new RegExp(`permission denied for function ${name}`));
      },
    );
  }

  it.each(Object.entries(FUNCTIONS))(
    "only service_role may execute %s, not PUBLIC",
    async (_, signature) => {
      const { rows } = await db.query<Record<SupabaseRole | "public", boolean>>(
        `select has_function_privilege('anon', $1, 'execute') as anon,
              has_function_privilege('authenticated', $1, 'execute') as authenticated,
              has_function_privilege('service_role', $1, 'execute') as service_role,
              exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                      where p.oid = $1::regprocedure and a.grantee = 0) as public`,
        [signature],
      );
      expect(rows[0]).toEqual({
        anon: false,
        authenticated: false,
        service_role: true,
        public: false,
      });
    },
  );
});

describe("catalog", () => {
  it.each(Object.entries(FUNCTIONS))(
    "%s is SECURITY INVOKER with search_path = ''",
    async (_, signature) => {
      const { rows } = await db.query<{ proconfig: string[]; prosecdef: boolean }>(
        "select proconfig, prosecdef from pg_proc where oid = $1::regprocedure",
        [signature],
      );
      expect(rows[0]!.prosecdef).toBe(false);
      expect(rows[0]!.proconfig).toContain('search_path=""');
    },
  );

  it("match_chunks scans HNSW in strict order", async () => {
    const { rows } = await db.query<{ proconfig: string[] }>(
      "select proconfig from pg_proc where oid = $1::regprocedure",
      [FUNCTIONS.match_chunks],
    );
    expect(rows[0]!.proconfig).toContain("hnsw.iterative_scan=strict_order");
  });
});
