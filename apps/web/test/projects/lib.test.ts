import { ProjectSchema } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT, PROJECT_ID, projectRow, requestOf } from "./stub";

vi.mock("server-only", () => ({}));

const ownerFetch = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock("../../lib/supabase/owner", async () => {
  const { stubClient } = await import("./stub");
  return { createOwnerClient: () => stubClient(ownerFetch) };
});

const { getOwnedProject, toProject } = await import("../../lib/projects");

describe("toProject", () => {
  it("maps a snake_case row to the shared Project", () => {
    const project = toProject(projectRow());
    expect(project).toEqual(PROJECT);
    expect(ProjectSchema.parse(project)).toEqual(project);
  });

  it("drops columns that aren't part of Project", () => {
    const project = toProject(projectRow({ owner_id: "user_owner" }));
    expect(Object.keys(project).sort()).toEqual(Object.keys(ProjectSchema.shape).sort());
  });
});

describe("getOwnedProject", () => {
  beforeEach(() => {
    ownerFetch.mockReset();
    ownerFetch.mockResolvedValue(Response.json([]));
  });

  it("reads by id through the owner client, with no manual owner filter", async () => {
    ownerFetch.mockResolvedValueOnce(Response.json([projectRow()]));
    expect(await getOwnedProject(PROJECT_ID)).toEqual(PROJECT);

    const { method, url } = requestOf(ownerFetch);
    expect(method).toBe("GET");
    expect(url.pathname).toBe("/rest/v1/projects");
    expect(url.searchParams.get("id")).toBe(`eq.${PROJECT_ID}`);
    expect([...url.searchParams.keys()].sort()).toEqual(["id", "select"]);
    expect(url.searchParams.get("select")).not.toContain("owner_id");
  });

  it("returns null when RLS hides the row (missing or not yours)", async () => {
    expect(await getOwnedProject(PROJECT_ID)).toBeNull();
  });

  it("throws on a PostgREST error", async () => {
    ownerFetch.mockResolvedValueOnce(Response.json({ message: "boom" }, { status: 500 }));
    await expect(getOwnedProject(PROJECT_ID)).rejects.toThrow("getOwnedProject: boom");
  });
});
