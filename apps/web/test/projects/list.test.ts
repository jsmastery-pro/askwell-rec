import { ApiErrorSchema, ListProjectsResponseSchema } from "@askwell/shared";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OTHER_PROJECT_ID, PROJECT, projectRow, requestOf } from "./stub";

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

const { GET } = await import("../../app/api/projects/route");

const list = () => GET(new NextRequest("https://askwell.test/api/projects"));

describe("GET /api/projects", () => {
  beforeEach(() => {
    state.userId = "user_a";
    ownerFetch.mockReset();
    ownerFetch.mockResolvedValue(Response.json([]));
    serviceFetch.mockReset();
  });

  it("lists the owner's projects newest first, through the owner client only", async () => {
    const newer = projectRow({ id: OTHER_PROJECT_ID, created_at: "2026-10-31T00:00:00+00:00" });
    ownerFetch.mockResolvedValueOnce(Response.json([newer, projectRow()]));

    const res = await list();
    expect(res.status).toBe(200);
    const body = ListProjectsResponseSchema.parse(await res.json());
    expect(body.projects.map((p) => p.id)).toEqual([OTHER_PROJECT_ID, PROJECT.id]);
    expect(body.projects[1]).toEqual(PROJECT);

    const { method, url } = requestOf(ownerFetch);
    expect(method).toBe("GET");
    expect(url.pathname).toBe("/rest/v1/projects");
    expect(url.searchParams.get("order")).toBe("created_at.desc");
    // RLS scopes the rows: no manual owner filter, no owner_id selected.
    expect([...url.searchParams.keys()].sort()).toEqual(["order", "select"]);
    expect(url.searchParams.get("select")).not.toContain("owner_id");
    expect(serviceFetch).not.toHaveBeenCalled();
  });

  it("an owner with no projects gets an empty list", async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ projects: [] });
  });

  it("signed out → 401, no database call", async () => {
    state.userId = null;
    const res = await list();
    expect(res.status).toBe(401);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("unauthorized");
    expect(ownerFetch).not.toHaveBeenCalled();
  });

  it("database error → 500 internal, no detail leaked", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    ownerFetch.mockResolvedValueOnce(Response.json({ message: "secret detail" }, { status: 500 }));
    const res = await list();
    expect(res.status).toBe(500);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("internal");
    expect(body.error.message).not.toContain("secret detail");
  });

  it("sends no CORS headers", async () => {
    const res = await list();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
