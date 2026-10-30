import { ApiErrorSchema, CreateProjectResponseSchema, PLAN_LIMITS } from "@askwell/shared";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT, jsonRequest, projectRow, requestOf } from "./stub";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ userId: "user_a" as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: state.userId }) }));

const ownerFetch = vi.hoisted(() => vi.fn<typeof fetch>());
const serviceFetch = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock("../../lib/supabase/owner", async () => {
  const { stubClient } = await import("./stub");
  return { createOwnerClient: () => stubClient(ownerFetch) };
});
vi.mock("../../lib/supabase/service", async () => {
  const { stubClient } = await import("./stub");
  return { createServiceClient: () => stubClient(serviceFetch) };
});

const { POST } = await import("../../app/api/projects/route");

const create = (body: unknown) =>
  POST(new NextRequest(jsonRequest("https://askwell.test/api/projects", "POST", body)));

// What PostgREST sends for `raise exception 'limit_reached' using errcode = 'P0001'`.
const limitReached = () =>
  Response.json(
    { code: "P0001", message: "limit_reached", details: null, hint: null },
    { status: 400 },
  );

describe("POST /api/projects", () => {
  beforeEach(() => {
    state.userId = "user_a";
    ownerFetch.mockReset();
    serviceFetch.mockReset();
    serviceFetch.mockResolvedValue(Response.json(projectRow({ owner_id: "user_a" })));
  });

  it("calls create_project with Clerk's user ID and PLAN_LIMITS → 201 with the project", async () => {
    const res = await create({ name: "  Docs bot  " });

    expect(res.status).toBe(201);
    const body = CreateProjectResponseSchema.strict().parse(await res.json());
    expect(body).toEqual({ project: PROJECT });
    expect(JSON.stringify(body)).not.toContain("user_a");

    expect(serviceFetch).toHaveBeenCalledTimes(1);
    const { method, url, body: rpcBody } = requestOf(serviceFetch);
    expect(method).toBe("POST");
    expect(url.pathname).toBe("/rest/v1/rpc/create_project");
    expect(rpcBody).toEqual({
      p_owner_id: "user_a",
      p_name: "Docs bot",
      p_project_limits: { free: PLAN_LIMITS.free.projects, pro: PLAN_LIMITS.pro.projects },
    });
    expect(ownerFetch).not.toHaveBeenCalled();
  });

  it("never takes the owner or plan from the body", async () => {
    await create({ name: "Docs bot", ownerId: "user_b", owner_id: "user_b", plan: "pro" });
    expect(requestOf(serviceFetch).body).toMatchObject({ p_owner_id: "user_a" });
    expect(JSON.stringify(requestOf(serviceFetch).body)).not.toContain("user_b");
  });

  it("limit_reached from create_project → 403 limit_reached", async () => {
    serviceFetch.mockResolvedValueOnce(limitReached());
    const res = await create({ name: "Second" });

    expect(res.status).toBe(403);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("limit_reached");
  });

  it.each([
    ["missing name", {}],
    ["empty name", { name: "" }],
    ["blank name", { name: "   " }],
    ["too long", { name: "x".repeat(81) }],
    ["not a string", { name: 42 }],
    ["not JSON", "{oops"],
  ])("%s → 400 invalid_input, no database call", async (_, body) => {
    const res = await create(body);
    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("invalid_input");
    expect(serviceFetch).not.toHaveBeenCalled();
  });

  it("signed out → 401, no database call", async () => {
    state.userId = null;
    const res = await create({ name: "Docs bot" });
    expect(res.status).toBe(401);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("unauthorized");
    expect(serviceFetch).not.toHaveBeenCalled();
  });

  it("any other database error → 500 internal, no detail leaked", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    serviceFetch.mockResolvedValueOnce(
      Response.json(
        { code: "P0001", message: "create_project: no project limit for plan x" },
        {
          status: 400,
        },
      ),
    );
    const res = await create({ name: "Docs bot" });
    expect(res.status).toBe(500);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("internal");
    expect(body.error.message).not.toContain("create_project");
  });
});
