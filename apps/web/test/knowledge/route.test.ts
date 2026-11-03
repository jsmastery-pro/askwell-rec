import {
  ApiErrorSchema,
  CreateKnowledgeTextResponseSchema,
  KNOWLEDGE_TEXT_MAX_LENGTH,
  KNOWLEDGE_TITLE_MAX_LENGTH,
  PLAN_LIMITS,
} from "@askwell/shared";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SOURCE_ID, sourceRow } from "../knowledge-ui/stub";
import { PROJECT_ID, jsonRequest, projectRow, requestOf, routeContext } from "../projects/stub";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ userId: "user_a" as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: state.userId }) }));

// after() needs a live request scope; collect the callbacks and run them by hand.
const afterCallbacks = vi.hoisted(() => [] as (() => unknown)[]);
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => afterCallbacks.push(fn),
}));

const processSource = vi.hoisted(() => vi.fn(async () => "ready" as const));
vi.mock("../../lib/knowledge", () => ({ processSource }));

const ownerFetch = vi.hoisted(() => vi.fn<typeof fetch>());
const serviceFetch = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock("../../lib/supabase/owner", async () => {
  const { stubClient } = await import("../projects/stub");
  return { createOwnerClient: () => stubClient(ownerFetch) };
});
vi.mock("../../lib/supabase/service", async () => {
  const { stubClient } = await import("../projects/stub");
  return { createServiceClient: () => stubClient(serviceFetch) };
});

const { POST } = await import("../../app/api/projects/[id]/knowledge/route");

const URL_ = `https://askwell.test/api/projects/${PROJECT_ID}/knowledge`;
const BODY = { title: "Shipping", content: "We ship worldwide." };
const post = (body: unknown = BODY, id = PROJECT_ID) =>
  POST(new NextRequest(jsonRequest(URL_, "POST", body)), routeContext(id));

/** The owner's reads: the project (or none, for someone else's) and their plan. */
function respondOwner({ owned = true, plan = "free" }: { owned?: boolean; plan?: string } = {}) {
  ownerFetch.mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/rest/v1/projects") return Response.json(owned ? [projectRow()] : []);
    if (path === "/rest/v1/accounts") return Response.json([{ plan }]);
    return Response.json({ message: `unexpected ${path}` }, { status: 500 });
  });
}

const reserved = sourceRow({ type: "text", status: "processing", storage_key: null });

async function errorCode(res: Response) {
  return ApiErrorSchema.parse(await res.json()).error.code;
}

describe("POST /api/projects/:id/knowledge", () => {
  beforeEach(() => {
    state.userId = "user_a";
    afterCallbacks.length = 0;
    processSource.mockClear();
    ownerFetch.mockReset();
    serviceFetch.mockReset();
    respondOwner();
    serviceFetch.mockResolvedValue(Response.json(reserved));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reserves a processing text source → 200 with it, then processes it after the response", async () => {
    const res = await post({ title: "  Shipping ", content: " We ship worldwide. " });

    expect(res.status).toBe(200);
    const body = CreateKnowledgeTextResponseSchema.strict().parse(await res.json());
    expect(body.source).toEqual({
      id: SOURCE_ID,
      projectId: PROJECT_ID,
      title: "Shipping policy",
      type: "text",
      status: "processing",
      createdAt: reserved.created_at,
    });

    const { url, body: rpcBody } = requestOf(serviceFetch);
    expect(url.pathname).toBe("/rest/v1/rpc/reserve_knowledge_source");
    expect(rpcBody).toEqual({
      p_project_id: PROJECT_ID,
      p_title: "Shipping",
      p_type: "text",
      p_storage_key: null,
      p_status: "processing",
      p_limit: PLAN_LIMITS.free.knowledgeSourcesPerProject,
    });

    // Not processed before the response; once after() runs, with the title on top.
    expect(processSource).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]!();
    expect(processSource).toHaveBeenCalledWith(
      SOURCE_ID,
      PROJECT_ID,
      "# Shipping\n\nWe ship worldwide.",
    );
  });

  it("passes the Pro limit for a Pro owner, read from the database", async () => {
    respondOwner({ plan: "pro" });
    await post({ ...BODY, plan: "pro", p_limit: 999 });
    expect(requestOf(serviceFetch).body).toMatchObject({
      p_limit: PLAN_LIMITS.pro.knowledgeSourcesPerProject,
    });
  });

  it("reads the project and plan through the owner client, with no owner filter", async () => {
    await post();
    const urls = ownerFetch.mock.calls.map(([input]) => new URL(String(input)));
    const projects = urls.find((u) => u.pathname === "/rest/v1/projects")!;
    expect(projects.searchParams.get("id")).toBe(`eq.${PROJECT_ID}`);
    expect(projects.searchParams.has("owner_id")).toBe(false);
    const accounts = urls.find((u) => u.pathname === "/rest/v1/accounts")!;
    expect([...accounts.searchParams.keys()]).toEqual(["select"]);
  });

  it("limit_reached → 403 limit_reached, and nothing is processed", async () => {
    serviceFetch.mockResolvedValueOnce(
      Response.json(
        { code: "P0001", message: "limit_reached", details: null, hint: null },
        { status: 400 },
      ),
    );
    const res = await post();
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("limit_reached");
    expect(afterCallbacks).toHaveLength(0);
  });

  it("another owner's (or a missing) project → 404, with no reservation", async () => {
    respondOwner({ owned: false });
    const res = await post();
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("not_found");
    expect(serviceFetch).not.toHaveBeenCalled();
  });

  it("no session → 401, nothing read", async () => {
    state.userId = null;
    const res = await post();
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("unauthorized");
    expect(ownerFetch).not.toHaveBeenCalled();
    expect(serviceFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["missing title", { content: "x" }],
    ["blank title", { title: "  ", content: "x" }],
    ["blank content", { title: "T", content: " \n " }],
    ["title too long", { title: "x".repeat(KNOWLEDGE_TITLE_MAX_LENGTH + 1), content: "x" }],
    ["content too long", { title: "T", content: "x".repeat(KNOWLEDGE_TEXT_MAX_LENGTH + 1) }],
    ["not JSON", "{oops"],
  ])("%s → 400 invalid_input, nothing read", async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("invalid_input");
    expect(ownerFetch).not.toHaveBeenCalled();
    expect(serviceFetch).not.toHaveBeenCalled();
  });

  it("a malformed project id → 400 invalid_input", async () => {
    const res = await post(BODY, "not-a-uuid");
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("invalid_input");
  });

  it("a database error → 500 internal, as JSON", async () => {
    ownerFetch.mockResolvedValue(Response.json({ message: "boom" }, { status: 500 }));
    const res = await post();
    expect(res.status).toBe(500);
    expect(await errorCode(res)).toBe("internal");

    respondOwner();
    serviceFetch.mockResolvedValueOnce(Response.json({ message: "boom" }, { status: 500 }));
    const rpcFailed = await post();
    expect(rpcFailed.status).toBe(500);
    expect(afterCallbacks).toHaveLength(0);
  });
});
