import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT, PROJECT_ID } from "../projects/stub";

vi.mock("server-only", () => ({}));

const nav = vi.hoisted(() => ({
  pathname: "/dashboard/projects/x/install",
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: nav.notFound,
  redirect: nav.redirect,
  usePathname: () => nav.pathname,
}));

const getOwnedProject = vi.hoisted(() => vi.fn<(id: string) => Promise<typeof PROJECT | null>>());
vi.mock("../../lib/projects", () => ({ getOwnedProject }));

const { default: ProjectLayout } = await import("../../app/dashboard/projects/[id]/layout");
const { default: ProjectPage } = await import("../../app/dashboard/projects/[id]/page");
const { default: ProjectNotFound } = await import("../../app/dashboard/projects/[id]/not-found");
const { default: Loading } = await import("../../app/dashboard/projects/[id]/loading");
const { default: ProjectError } = await import("../../app/dashboard/projects/[id]/error");

const layout = (id: string) =>
  ProjectLayout({ children: <p>Tab body</p>, params: Promise.resolve({ id }) });

describe("project layout", () => {
  beforeEach(() => {
    nav.pathname = `/dashboard/projects/${PROJECT_ID}/install`;
    nav.notFound.mockClear();
    getOwnedProject.mockReset();
  });

  it("calls notFound() when getOwnedProject returns null (missing or someone else's)", async () => {
    getOwnedProject.mockResolvedValue(null);
    await expect(layout(PROJECT_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getOwnedProject).toHaveBeenCalledWith(PROJECT_ID);
    expect(nav.notFound).toHaveBeenCalledTimes(1);
  });

  it("calls notFound() for a malformed id without reading the database", async () => {
    await expect(layout("not-a-uuid")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getOwnedProject).not.toHaveBeenCalled();
  });

  it("renders the project name, the tabs and the tab body for the owner", async () => {
    getOwnedProject.mockResolvedValue(PROJECT);
    const html = renderToStaticMarkup(await layout(PROJECT_ID));

    expect(nav.notFound).not.toHaveBeenCalled();
    expect(html).toMatch(/<h1[^>]*>Docs bot<\/h1>/);
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('aria-label="Project"');
    expect(html).toContain("Tab body");
  });

  it("propagates a database error to the error boundary", async () => {
    getOwnedProject.mockRejectedValue(new Error("getOwnedProject: boom"));
    await expect(layout(PROJECT_ID)).rejects.toThrow("getOwnedProject: boom");
  });
});

describe("project tabs", () => {
  beforeEach(() => {
    getOwnedProject.mockReset();
    getOwnedProject.mockResolvedValue(PROJECT);
  });

  it("Install is a link, marked current on its page", async () => {
    const html = renderToStaticMarkup(await layout(PROJECT_ID));
    const install = html.match(/<a [^>]*>Install<\/a>/)?.[0];
    expect(install).toContain(`href="/dashboard/projects/${PROJECT_ID}/install"`);
    expect(install).toContain('aria-current="page"');
  });

  it("Install isn't marked current on another page", async () => {
    nav.pathname = "/dashboard";
    const html = renderToStaticMarkup(await layout(PROJECT_ID));
    expect(html.match(/<a [^>]*>Install<\/a>/)?.[0]).not.toContain("aria-current");
  });

  it("Knowledge, Conversations and Customize are disabled 'Soon' items, not links", async () => {
    const html = renderToStaticMarkup(await layout(PROJECT_ID));
    for (const label of ["Knowledge", "Conversations", "Customize"]) {
      expect(html).toMatch(
        new RegExp(`<span aria-disabled="true"[^>]*>${label}<span[^>]*>Soon</span>`),
      );
      expect(html).not.toContain(`/${label.toLowerCase()}"`);
    }
  });
});

describe("project page and states", () => {
  it("page.tsx redirects to install", async () => {
    await expect(
      ProjectPage({
        params: Promise.resolve({ id: PROJECT_ID }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:/dashboard/projects/${PROJECT_ID}/install`);
  });

  it("not-found links back to all projects", () => {
    const html = renderToStaticMarkup(<ProjectNotFound />);
    expect(html).toContain("Project not found");
    expect(html).toMatch(/href="\/dashboard"[^>]*>All projects</);
  });

  it("loading and error states render", () => {
    expect(renderToStaticMarkup(<Loading />)).toContain('role="status"');
    const error = renderToStaticMarkup(<ProjectError error={new Error("x")} retry={() => {}} />);
    expect(error).toContain('role="alert"');
    expect(error).toContain("Try again");
  });
});
