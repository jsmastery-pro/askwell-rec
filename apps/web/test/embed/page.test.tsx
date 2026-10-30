import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WidgetConfig } from "@askwell/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicWidgetConfig = vi.hoisted(() =>
  vi.fn<(key: string) => Promise<WidgetConfig | null>>(),
);
vi.mock("../../lib/widget-config", () => ({ getPublicWidgetConfig }));

import EmbedPage from "../../app/embed/page";

const CONFIG: WidgetConfig = {
  buttonColor: "#000000",
  position: "bottom-right",
  label: "Chat with us",
  animation: "fade",
  headerText: "Ask Acme anything",
  showBadge: true,
};

async function renderPage(params: Record<string, string | string[] | undefined>) {
  return renderToStaticMarkup(await EmbedPage({ searchParams: Promise.resolve(params) }));
}

describe("/embed page", () => {
  beforeEach(() => {
    getPublicWidgetConfig.mockReset();
  });

  it("loads the config for the key and renders the panel with it", async () => {
    getPublicWidgetConfig.mockResolvedValue(CONFIG);
    const html = await renderPage({ key: "pk_test_abc12345" });
    expect(getPublicWidgetConfig).toHaveBeenCalledWith("pk_test_abc12345");
    expect(html).toContain("Ask Acme anything");
    expect(html).toContain("Powered by");
    expect(html).not.toContain("Chat unavailable");
  });

  it("passes the plan-applied showBadge through", async () => {
    getPublicWidgetConfig.mockResolvedValue({ ...CONFIG, showBadge: false });
    expect(await renderPage({ key: "pk_test_abc12345" })).not.toContain("Powered by");
  });

  it.each([
    ["no key", {}],
    ["a malformed key", { key: "not-a-key" }],
    ["a repeated key", { key: ["pk_test_abc12345", "pk_test_abc12345"] }],
  ])("%s → unavailable, without a lookup", async (_name, params) => {
    const html = await renderPage(params);
    expect(html).toContain("Chat unavailable");
    expect(getPublicWidgetConfig).not.toHaveBeenCalled();
  });

  it("an unknown key → unavailable", async () => {
    getPublicWidgetConfig.mockResolvedValue(null);
    expect(await renderPage({ key: "pk_test_unknown99" })).toContain("Chat unavailable");
  });

  it("a config error → unavailable, logged, no crash", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getPublicWidgetConfig.mockRejectedValue(new Error("db down"));
    expect(await renderPage({ key: "pk_test_abc12345" })).toContain("Chat unavailable");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("embed source rules (§9 XSS, postMessage)", () => {
  const WEB_ROOT = fileURLToPath(new URL("../..", import.meta.url));

  async function files(dir: string): Promise<string[]> {
    const entries = await readdir(join(WEB_ROOT, dir), { withFileTypes: true, recursive: true });
    return entries
      .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name))
      .map((e) => join(e.parentPath, e.name));
  }

  it("never uses dangerouslySetInnerHTML or posts to *", async () => {
    const sources = [...(await files("app/embed")), ...(await files("components/embed"))];
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      const source = await readFile(file, "utf8");
      expect(source, file).not.toContain("dangerouslySetInnerHTML");
      expect(source, file).not.toMatch(/postMessage\([^)]*["'`]\*["'`]/);
    }
  });
});
