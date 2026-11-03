import { describe, expect, it, vi } from "vitest";
import { makePdf } from "./pdf";

vi.mock("server-only", () => ({}));

const { extractText } = await import("../../lib/knowledge/extract");

const utf8 = (text: string) => new TextEncoder().encode(text);

describe("extractText", () => {
  it("reads a PDF's text with unpdf", async () => {
    const text = await extractText(makePdf("Returns are free within 30 days."), "pdf");
    expect(text).toContain("Returns are free within 30 days.");
  });

  it("leaves the caller's bytes usable (pdf.js gets a copy)", async () => {
    const bytes = makePdf("Hello");
    await extractText(bytes, "pdf");
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("rejects bytes that aren't a PDF", async () => {
    await expect(extractText(utf8("just text, not a pdf"), "pdf")).rejects.toThrow();
  });

  it.each(["md", "txt"] as const)("reads %s as UTF-8, without a BOM", async (type) => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8("# Café ☕\n\nOpen daily.")]);
    expect(await extractText(bytes, type)).toBe("# Café ☕\n\nOpen daily.");
  });

  it("rejects a binary file posing as text", async () => {
    await expect(extractText(new Uint8Array([0xff, 0xfe, 0x00, 0xc3]), "txt")).rejects.toThrow();
  });
});
