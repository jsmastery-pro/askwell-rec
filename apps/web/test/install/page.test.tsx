import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT, PROJECT_ID } from "../projects/stub";

vi.mock("server-only", () => ({}));

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
vi.mock("next/navigation", () => ({ notFound }));

const getOwnedProject = vi.hoisted(() => vi.fn<(id: string) => Promise<typeof PROJECT | null>>());
vi.mock("../../lib/projects", () => ({ getOwnedProject }));

const { default: InstallPage } = await import("../../app/dashboard/projects/[id]/install/page");

const render = async (id: string) =>
  renderToStaticMarkup(
    await InstallPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }),
  );

describe("Install page", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "askwell-rec-abc123-team.vercel.app");
    notFound.mockClear();
    getOwnedProject.mockReset();
    getOwnedProject.mockResolvedValue(PROJECT);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the project's snippet, pointing at this deployment, as escaped text", async () => {
    const html = await render(PROJECT_ID);

    expect(getOwnedProject).toHaveBeenCalledWith(PROJECT_ID);
    // Escaped: the tag is shown as text, never injected as a live <script>.
    expect(html).toContain(
      `&lt;script src=&quot;https://askwell-rec-abc123-team.vercel.app/widget.js&quot; data-key=&quot;${PROJECT.publicKey}&quot; async&gt;&lt;/script&gt;`,
    );
    expect(html).not.toContain("<script");
    expect(html).toMatch(/<button [^>]*>Copy<\/button>/);
  });

  it("shows the 3 steps", async () => {
    const html = await render(PROJECT_ID);
    expect(html.match(/<li /g)).toHaveLength(3);
    expect(html).toContain("Copy the tag below.");
    expect(html).toContain("just before the closing &lt;/body&gt; tag");
    expect(html).toContain("Reload your site.");
  });

  it("calls notFound() when the project is missing or someone else's", async () => {
    getOwnedProject.mockResolvedValue(null);
    await expect(render(PROJECT_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("calls notFound() for a malformed id without reading the database", async () => {
    await expect(render("not-a-uuid")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getOwnedProject).not.toHaveBeenCalled();
  });
});
