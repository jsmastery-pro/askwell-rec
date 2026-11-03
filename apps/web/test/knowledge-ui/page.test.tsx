import { PLAN_LIMITS } from "@askwell/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STALE_UPLOAD_MS } from "../../components/knowledge";
import { PROJECT, PROJECT_ID } from "../projects/stub";
import { OTHER_SOURCE_ID, sourceRow } from "./stub";

vi.mock("server-only", () => ({}));

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
vi.mock("next/navigation", () => ({ notFound, useRouter: () => ({ refresh: vi.fn() }) }));

const getOwnedProject = vi.hoisted(() => vi.fn<(id: string) => Promise<typeof PROJECT | null>>());
vi.mock("../../lib/projects", () => ({ getOwnedProject }));

const ownerFetch = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock("../../lib/supabase/owner", async () => {
  const { stubClient } = await import("../projects/stub");
  return { createOwnerClient: () => stubClient(ownerFetch) };
});

const { default: KnowledgePage } =
  await import("../../app/(site)/dashboard/projects/[id]/knowledge/page");

/** Answers the page's reads: the source list and the owner's account row. */
function respond(sources: object[], plan: string | null = "free") {
  ownerFetch.mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/rest/v1/knowledge_sources") return Response.json(sources);
    if (path === "/rest/v1/accounts") return Response.json(plan ? [{ plan }] : []);
    return Response.json({ message: `unexpected ${path}` }, { status: 500 });
  });
}

const render = async (id = PROJECT_ID) =>
  renderToStaticMarkup(
    await KnowledgePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }),
  );

const NOW = new Date("2026-11-03T12:00:00.000Z");

describe("Knowledge page", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    ownerFetch.mockReset();
    notFound.mockClear();
    getOwnedProject.mockReset();
    getOwnedProject.mockResolvedValue(PROJECT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists sources with title, type, status and date; uploading shows as Processing", async () => {
    respond([
      sourceRow({ id: OTHER_SOURCE_ID, title: "Guide", type: "pdf", status: "uploading" }),
      sourceRow(),
    ]);
    const html = await render();

    const list = html.slice(html.indexOf('aria-label="Knowledge sources"'));
    expect(list.indexOf(">Guide<")).toBeGreaterThan(-1);
    expect(list.indexOf(">Guide<")).toBeLessThan(list.indexOf(">Shipping policy<"));
    expect(html).toContain("PDF");
    expect(html).toContain("Pasted text");
    expect(html).toMatch(/>Processing<\/span>/);
    expect(html).toMatch(/>Ready<\/span>/);
    expect(html).not.toContain("uploading");
    expect(html).toContain('<time dateTime="2026-11-02T10:00:00.123456+00:00">Nov 2, 2026</time>');
    expect(html.match(/>Delete</g)).toHaveLength(2);
  });

  it("shows N of M sources used, with M from PLAN_LIMITS for the owner's plan", async () => {
    respond([sourceRow()], "pro");
    expect(await render()).toContain(
      `1 of ${PLAN_LIMITS.pro.knowledgeSourcesPerProject} sources used`,
    );
    respond([sourceRow()], null);
    expect(await render()).toContain(
      `1 of ${PLAN_LIMITS.free.knowledgeSourcesPerProject} sources used`,
    );
  });

  it("below the limit shows both add forms", async () => {
    respond([sourceRow()]);
    const html = await render();
    expect(html).toContain('aria-label="Paste text"');
    expect(html).toContain('type="file"');
    expect(html).not.toContain('role="alert"');
  });

  it("a Free project at its limit shows the limit message and no way to add", async () => {
    const free = PLAN_LIMITS.free.knowledgeSourcesPerProject;
    respond(
      Array.from({ length: free }, (_, i) =>
        sourceRow({ id: `3333333${i}-3333-4333-8333-333333333333`, title: `Doc ${i}` }),
      ),
    );
    const html = await render();

    expect(html).toContain(`${free} of ${free} sources used`);
    expect(html).toContain(`The Free plan allows ${free} sources per project.`);
    expect(html).toMatch(/<a [^>]*href="\/dashboard\/billing"[^>]*>Upgrade<\/a>/);
    expect(html).not.toContain('aria-label="Paste text"');
    expect(html).not.toContain('type="file"');
  });

  it("a failed source says so, and can be deleted", async () => {
    respond([sourceRow({ status: "failed" })]);
    const html = await render();
    expect(html).toMatch(/>Failed<\/span>/);
    expect(html).toContain("couldn&#x27;t be processed");
    expect(html).toContain(">Delete<");
  });

  it("shows the empty state with the add forms when there are no sources", async () => {
    respond([]);
    const html = await render();
    expect(html).toContain("No knowledge yet");
    expect(html).toContain('aria-label="Paste text"');
    expect(html).not.toContain('aria-label="Knowledge sources"');
  });

  it("renders titles as text, never HTML", async () => {
    respond([sourceRow({ title: '<img src=x onerror="alert(1)">' })]);
    const html = await render();
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("reads this project's sources through the owner client, newest first, without stale reservations", async () => {
    respond([]);
    await render();

    const url = ownerFetch.mock.calls
      .map(([input]) => new URL(String(input)))
      .find((u) => u.pathname === "/rest/v1/knowledge_sources")!;
    expect(url.searchParams.get("select")).toBe("id,project_id,title,type,status,created_at");
    expect(url.searchParams.get("project_id")).toBe(`eq.${PROJECT_ID}`);
    expect(url.searchParams.get("order")).toBe("created_at.desc");
    const staleBefore = new Date(NOW.getTime() - STALE_UPLOAD_MS).toISOString();
    expect(url.searchParams.get("or")).toBe(`(status.neq.uploading,created_at.gte.${staleBefore})`);
    expect([...url.searchParams.keys()].sort()).toEqual(["or", "order", "project_id", "select"]);
    expect(STALE_UPLOAD_MS).toBe(2 * 60 * 60 * 1000);
  });

  it("calls notFound() for someone else's or a missing project", async () => {
    respond([]);
    getOwnedProject.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getOwnedProject).toHaveBeenCalledWith(PROJECT_ID);
  });

  it("calls notFound() for a malformed id without reading the database", async () => {
    await expect(render("not-a-uuid")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(ownerFetch).not.toHaveBeenCalled();
    expect(getOwnedProject).not.toHaveBeenCalled();
  });

  it("throws on a database error, for the error boundary", async () => {
    ownerFetch.mockResolvedValue(Response.json({ message: "boom" }, { status: 500 }));
    await expect(render()).rejects.toThrow("KnowledgePage: boom");
  });
});
