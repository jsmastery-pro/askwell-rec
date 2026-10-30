import { ApiErrorSchema, DeleteProjectResponseSchema } from "@askwell/shared";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_ID, requestOf, routeContext } from "./stub";

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

const { DELETE } = await import("../../app/api/projects/[id]/route");

const remove = (id: string) =>
  DELETE(
    new NextRequest(`https://askwell.test/api/projects/${id}`, { method: "DELETE" }),
    routeContext(id),
  );

describe("DELETE /api/projects/[id]", () => {
  beforeEach(() => {
    state.userId = "user_a";
    ownerFetch.mockReset();
    ownerFetch.mockResolvedValue(Response.json([]));
    serviceFetch.mockReset();
  });

  it("deletes through the owner client → 200 with the id", async () => {
    ownerFetch.mockResolvedValueOnce(Response.json([{ id: PROJECT_ID }]));
    const res = await remove(PROJECT_ID);

    expect(res.status).toBe(200);
    expect(DeleteProjectResponseSchema.strict().parse(await res.json())).toEqual({
      id: PROJECT_ID,
    });

    const { method, url } = requestOf(ownerFetch);
    expect(method).toBe("DELETE");
    expect(url.pathname).toBe("/rest/v1/projects");
    expect(url.searchParams.get("id")).toBe(`eq.${PROJECT_ID}`);
    expect([...url.searchParams.keys()].sort()).toEqual(["id", "select"]);
    expect(serviceFetch).not.toHaveBeenCalled();
  });

  it("not found or not yours (RLS deletes no row) → 404", async () => {
    const res = await remove(PROJECT_ID);
    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
  });

  it("bad id → 400 invalid_input, no database call", async () => {
    const res = await remove("not-a-uuid");
    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("invalid_input");
    expect(ownerFetch).not.toHaveBeenCalled();
  });

  it("signed out → 401, no database call", async () => {
    state.userId = null;
    const res = await remove(PROJECT_ID);
    expect(res.status).toBe(401);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("unauthorized");
    expect(ownerFetch).not.toHaveBeenCalled();
  });

  it("database error → 500 internal", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    ownerFetch.mockResolvedValueOnce(Response.json({ message: "boom" }, { status: 500 }));
    const res = await remove(PROJECT_ID);
    expect(res.status).toBe(500);
    expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("internal");
  });
});
