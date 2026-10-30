import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_WIDGET_CONFIG, PLAN_LIMITS, PLANS } from "../../shared/src";
import { asRole, createTestDb, type SupabaseRole } from "../supabase-pglite";

// Tests for the create_project migration: plan limits, defaults, public keys and grants.

const SIGNATURE = "public.create_project(text, text, jsonb)";

// What the route passes: projects allowed per plan, from PLAN_LIMITS.
const PROJECT_LIMITS = Object.fromEntries(PLANS.map((plan) => [plan, PLAN_LIMITS[plan].projects]));

type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  public_key: string;
  messages_used: number;
};

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

async function createProject(tx: Transaction, ownerId: string, name = "My site") {
  const { rows } = await tx.query<ProjectRow>(
    "select * from public.create_project($1, $2, $3::jsonb)",
    [ownerId, name, JSON.stringify(PROJECT_LIMITS)],
  );
  return rows[0]!;
}

// One call per transaction, like one API request each.
const asService = <T>(fn: (tx: Transaction) => Promise<T>) =>
  asRole(db, "service_role", undefined, fn);

const createAsService = (ownerId: string, name?: string) =>
  asService((tx) => createProject(tx, ownerId, name));

async function seedAccount(ownerId: string, plan: string) {
  await db.query("insert into public.accounts (clerk_user_id, plan) values ($1, $2)", [
    ownerId,
    plan,
  ]);
}

async function projectCount(ownerId: string) {
  const { rows } = await db.query<{ n: number }>(
    "select count(*)::int as n from public.projects where owner_id = $1",
    [ownerId],
  );
  return rows[0]!.n;
}

describe("create_project as service_role", () => {
  it("a new owner with no account row → account on free, project and widget config created", async () => {
    const project = await createAsService("user_new", "Docs bot");

    const accounts = await db.query("select clerk_user_id, plan from public.accounts");
    expect(accounts.rows).toEqual([{ clerk_user_id: "user_new", plan: "free" }]);

    expect(project).toMatchObject({ owner_id: "user_new", name: "Docs bot", messages_used: 0 });
    const projects = await db.query<{ id: string }>("select id from public.projects");
    expect(projects.rows).toEqual([{ id: project.id }]);

    const configs = await db.query("select project_id from public.widget_configs");
    expect(configs.rows).toEqual([{ project_id: project.id }]);
  });

  it("keeps an existing account's plan", async () => {
    await seedAccount("user_pro", "pro");
    await createAsService("user_pro");
    const { rows } = await db.query("select plan from public.accounts where clerk_user_id = $1", [
      "user_pro",
    ]);
    expect(rows).toEqual([{ plan: "pro" }]);
  });

  it("a Free owner's 2nd call raises limit_reached (P0001) and creates nothing", async () => {
    await createAsService("user_free");

    await expect(createAsService("user_free")).rejects.toMatchObject({
      message: "limit_reached",
      code: "P0001",
    });
    expect(await projectCount("user_free")).toBe(PLAN_LIMITS.free.projects);
    const configs = await db.query<{ n: number }>(
      "select count(*)::int as n from public.widget_configs",
    );
    expect(configs.rows[0]!.n).toBe(PLAN_LIMITS.free.projects);
  });

  it("a Pro owner can create 5, and the 6th raises limit_reached", async () => {
    await seedAccount("user_pro", "pro");
    expect(PLAN_LIMITS.pro.projects).toBe(5);

    for (let i = 0; i < PLAN_LIMITS.pro.projects; i++) {
      await createAsService("user_pro", `Site ${i}`);
    }
    expect(await projectCount("user_pro")).toBe(5);

    await expect(createAsService("user_pro")).rejects.toMatchObject({
      message: "limit_reached",
      code: "P0001",
    });
    expect(await projectCount("user_pro")).toBe(5);
  });

  it("counts each owner's projects separately", async () => {
    await createAsService("user_a");
    await createAsService("user_b");
    expect(await projectCount("user_a")).toBe(1);
    expect(await projectCount("user_b")).toBe(1);
  });

  it("reads the plan from accounts: a downgraded owner over the limit can't create more", async () => {
    await seedAccount("user_x", "pro");
    await createAsService("user_x");
    await createAsService("user_x");
    await db.query("update public.accounts set plan = 'free' where clerk_user_id = 'user_x'");

    await expect(createAsService("user_x")).rejects.toMatchObject({ message: "limit_reached" });
  });

  it("raises when the limits have no entry for the owner's plan", async () => {
    await seedAccount("user_pro", "pro");
    await expect(
      asService((tx) =>
        tx.query("select public.create_project($1, $2, $3::jsonb)", [
          "user_pro",
          "Site",
          JSON.stringify({ free: 1 }),
        ]),
      ),
    ).rejects.toThrow("create_project: no project limit for plan pro");
    expect(await projectCount("user_pro")).toBe(0);
  });

  it("public_key matches ^pk_[A-Za-z0-9_-]{24,}$, and two projects get different keys", async () => {
    await seedAccount("user_pro", "pro");
    const first = await createAsService("user_pro");
    const second = await createAsService("user_pro");

    for (const { public_key } of [first, second]) {
      expect(public_key).toMatch(/^pk_[A-Za-z0-9_-]{24,}$/);
    }
    expect(first.public_key).not.toBe(second.public_key);
  });

  it("the new widget_configs row equals DEFAULT_WIDGET_CONFIG", async () => {
    const project = await createAsService("user_new");
    const { rows } = await db.query(
      `select button_color as "buttonColor", position, label, animation, header_text as "headerText",
              show_badge as "showBadge"
       from public.widget_configs where project_id = $1`,
      [project.id],
    );
    expect(rows).toEqual([DEFAULT_WIDGET_CONFIG]);
  });
});

describe("create_project grants", () => {
  it.each(["anon", "authenticated"] as const)(
    "%s gets a permission error and creates nothing",
    async (role) => {
      await expect(
        asRole(db, role, { sub: "user_a" }, (tx) => createProject(tx, "user_a")),
      ).rejects.toThrow(/permission denied for function create_project/);

      const accounts = await db.query<{ n: number }>(
        "select count(*)::int as n from public.accounts",
      );
      expect(accounts.rows[0]!.n).toBe(0);
    },
  );

  it("only service_role may execute it, not PUBLIC", async () => {
    const { rows } = await db.query<Record<SupabaseRole | "public", boolean>>(
      `select has_function_privilege('anon', $1, 'execute') as anon,
              has_function_privilege('authenticated', $1, 'execute') as authenticated,
              has_function_privilege('service_role', $1, 'execute') as service_role,
              exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                      where p.oid = $1::regprocedure and a.grantee = 0) as public`,
      [SIGNATURE],
    );
    expect(rows[0]).toEqual({
      anon: false,
      authenticated: false,
      service_role: true,
      public: false,
    });
  });
});

describe("create_project catalog", () => {
  it("is SECURITY INVOKER with search_path = ''", async () => {
    const { rows } = await db.query<{ proconfig: string[]; prosecdef: boolean }>(
      "select proconfig, prosecdef from pg_proc where oid = $1::regprocedure",
      [SIGNATURE],
    );
    expect(rows).toEqual([{ proconfig: ['search_path=""'], prosecdef: false }]);
  });

  // pglite is one connection, so two parallel calls can't be run here. Guard the row lock
  // that makes them wait on each other instead.
  it("locks the owner's account row before counting", async () => {
    const { rows } = await db.query<{ src: string }>(
      "select prosrc as src from pg_proc where oid = $1::regprocedure",
      [SIGNATURE],
    );
    const src = rows[0]!.src.toLowerCase();
    const lock = src.search(
      /from public\.accounts a\s+where a\.clerk_user_id = p_owner_id\s+for update/,
    );
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(src.indexOf("count(*)"));
  });
});
