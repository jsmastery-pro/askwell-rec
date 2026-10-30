import { ApiErrorSchema, UpdateProjectResponseSchema } from "@askwell/shared";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT, PROJECT_ID, jsonRequest, projectRow, requestOf, routeContext } from "./stub";

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

const { PATCH } = await import("../../app/api/projects/[id]/route");

const rename = (id: string, body: unknown) =>
  PATCH(
    new NextRequest(jsonRequest(`https://askwell.test/api/projects/${id}`, "PATCH", body)),
    routeContext(id),
  );

describe("PATCH /api/projects/[id]", () => {
  beforeEach(() => {
    state.userId = "user_a";
    ownerFetch.mockReset();
    ownerFetch.mockResolvedValue(Response.json([]));
    serviceFetch.mockReset();
  });

  it("renames through the owner client, sending only the name → 200 with the project", async () => {
    ownerFetch.mockResolvedValueOnce(Response.json([projectRow({ name: "Renamed" })]));
    const res = await rename(PROJECT_ID, { name: "  Renamed  " });

    expect(res.status).toBe(200);
    const body = UpdateProjectResponseSchema.parse(await res.json());
    expect(body).toEqual({ project: { ...PROJECT, name: "Renamed" } });

    const { method, url, body: patch } = requestOf(ownerFetch);
    expect(method).toBe("PATCH");
    expect(url.pathname).toBe("/rest/v1/projects");
    expect(url.searchParams.get("id")).toBe(`eq.${PROJECT_ID}`);
    expect([...url.searchParams.keys()].sort()).toEqual(["id", "select"]);
    expect(patch).toEqual({ name: "Renamed" });
    expect(serviceFetch).not.toHaveBeenCalled();
  });

  it("ignores other fields in the body", async () => {
    ownerFetch.mockResolvedValueOnce(Response.json([projectRow()]));
    await rename(PROJECT_ID, { name: "Renamed", public_key: "pk_mine12345", messagesUsed: 0 });
    expect(requestOf(ownerFetch).body).toEqual({ name: "Renamed" });
  });

  it("not found or not yours (RLS returns no row) → 404", async () => {
    const res = await rename(PROJECT_ID, { name: "Renamed" });
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
  });

  it.each([
    ["empty name", PROJECT_ID, { name: "" }],
    ["too long", PROJECT_ID, { name: "x".repeat(81) }],
    ["not JSON", PROJECT_ID, "{oops"],
    ["bad id", "not-a-uuid", { name: "Renamed" }],
  ])("%s → 400 invalid_input, no database call", async (_, id, body) => {
    const res = await rename(id, body);
    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("invalid_input");
    expect(ownerFetch).not.toHaveBeenCalled();
  });

  it("signed out → 401, no database call", async () => {
    state.userId = null;
    const res = await rename(PROJECT_ID, { name: "Renamed" });
    expect(res.status).toBe(401);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("unauthorized");
    expect(ownerFetch).not.toHaveBeenCalled();
  });

  it("database error → 500 internal", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    ownerFetch.mockResolvedValueOnce(Response.json({ message: "boom" }, { status: 500 }));
    const res = await rename(PROJECT_ID, { name: "Renamed" });
    expect(res.status).toBe(500);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("internal");
  });
});
