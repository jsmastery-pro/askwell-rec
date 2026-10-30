import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OTHER_PROJECT_ID, PROJECT_ID, projectRow } from "../projects/stub";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/dashboard",
}));

const ownerFetch = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock("../../lib/supabase/owner", async () => {
  const { stubClient } = await import("../projects/stub");
  return { createOwnerClient: () => stubClient(ownerFetch) };
});

const { default: ProjectsPage } = await import("../../app/dashboard/page");

/** Answers the page's two reads: the project list and the owner's account row. */
function respond(projects: object[], plan: string | null = "free") {
  ownerFetch.mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/rest/v1/projects") return Response.json(projects);
    if (path === "/rest/v1/accounts") return Response.json(plan ? [{ plan }] : []);
    return Response.json({ message: `unexpected ${path}` }, { status: 500 });
  });
}

const render = async () => renderToStaticMarkup(await ProjectsPage());

describe("Projects page", () => {
  beforeEach(() => {
    ownerFetch.mockReset();
  });

  it("lists the owner's projects with name, created date and a link to the project page", async () => {
    respond([
      projectRow({ id: OTHER_PROJECT_ID, name: "Newer", created_at: "2026-10-31T08:00:00+00:00" }),
      projectRow({ name: "Docs bot" }),
    ]);
    const html = await render();

    expect(html).toContain("<h1");
    expect(html).not.toContain("No projects yet");
    expect(html.indexOf("Newer")).toBeLessThan(html.indexOf("Docs bot"));
    expect(html).toMatch(new RegExp(`href="/dashboard/projects/${PROJECT_ID}"[^>]*>Docs bot<`));
    expect(html).toMatch(new RegExp(`href="/dashboard/projects/${OTHER_PROJECT_ID}"[^>]*>Newer<`));
    expect(html).toContain('<time dateTime="2026-10-30T09:38:35.123456+00:00">Oct 30, 2026</time>');
    expect(html).toContain('<time dateTime="2026-10-31T08:00:00+00:00">Oct 31, 2026</time>');
    // Rename and delete on each card, and the create form above the list.
    expect(html.match(/>Rename</g)).toHaveLength(2);
    expect(html.match(/>Delete</g)).toHaveLength(2);
    expect(html).toContain("Project name");
  });

  it("shows the empty state with the create form when there are no projects", async () => {
    respond([]);
    const html = await render();

    expect(html).toContain("No projects yet");
    expect(html).toContain("Project name");
    expect(html).toMatch(/<button type="submit"[^>]*>New project<\/button>/);
    expect(html).not.toContain('aria-label="Your projects"');
  });

  it("reads through the owner client with no manual owner filter", async () => {
    respond([]);
    await render();

    const urls = ownerFetch.mock.calls.map(([input]) => new URL(String(input)));
    const projects = urls.find((u) => u.pathname === "/rest/v1/projects")!;
    expect(projects.searchParams.get("order")).toBe("created_at.desc");
    expect([...projects.searchParams.keys()].sort()).toEqual(["order", "select"]);
    const accounts = urls.find((u) => u.pathname === "/rest/v1/accounts")!;
    expect([...accounts.searchParams.keys()]).toEqual(["select"]);
  });

  it("throws on a database error, for the dashboard error boundary", async () => {
    ownerFetch.mockResolvedValue(Response.json({ message: "boom" }, { status: 500 }));
    await expect(ProjectsPage()).rejects.toThrow("ProjectsPage: boom");
  });
});
