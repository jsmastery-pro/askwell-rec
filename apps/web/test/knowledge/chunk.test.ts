import { describe, expect, it } from "vitest";
import {
  CHUNK_MAX_CHARS,
  CHUNK_OVERLAP_CHARS,
  CHUNK_TARGET_CHARS,
  chunkText,
  normalizeText,
} from "../../lib/knowledge/chunk";

// "Sentence n." repeated: easy to see where a chunk starts and ends.
const sentences = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `Sentence number ${from + i} is here.`).join(" ");

const paragraph = (n: number, chars: number) =>
  `Paragraph ${n}. ${"word ".repeat(chars / 5)}`.trim();

describe("chunkText", () => {
  it("empty, blank or NUL-only text gives no chunks", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("  \n\n \t\n")).toEqual([]);
    expect(chunkText("\u0000\u0000")).toEqual([]);
  });

  it("short text is one chunk, trimmed", () => {
    expect(chunkText("  We ship worldwide.\n\nReturns within 30 days.  ")).toEqual([
      "We ship worldwide.\n\nReturns within 30 days.",
    ]);
  });

  it("packs whole paragraphs up to the target, and never cuts inside a paragraph that fits", () => {
    const paragraphs = Array.from({ length: 12 }, (_, i) => paragraph(i, 1000));
    const chunks = chunkText(paragraphs.join("\n\n"));

    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
      expect(chunk.length).toBeGreaterThan(CHUNK_TARGET_CHARS / 2);
    }
    // Every paragraph is whole in some chunk.
    for (const p of paragraphs) expect(chunks.some((c) => c.includes(p))).toBe(true);
  });

  it("chunks cut for size repeat the end of the previous chunk", () => {
    const chunks = chunkText(Array.from({ length: 12 }, (_, i) => paragraph(i, 1000)).join("\n\n"));
    for (let i = 1; i < chunks.length; i++) {
      const overlap = chunks[i]!.slice(0, 50);
      expect(chunks[i - 1]!.slice(-CHUNK_OVERLAP_CHARS - 50)).toContain(overlap);
    }
  });

  it("splits a paragraph longer than a chunk at sentence ends", () => {
    const text = sentences(1, 400); // ~14,000 chars, no blank lines
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThanOrEqual(4);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
      expect(chunk).toMatch(/\.$/);
    }
    // Nothing is lost: every sentence appears.
    for (let n = 1; n <= 400; n++) {
      expect(chunks.some((c) => c.includes(`Sentence number ${n} is here.`))).toBe(true);
    }
  });

  it("text with no spaces at all still splits under the cap", () => {
    const chunks = chunkText("x".repeat(10_000));
    expect(chunks.join("").replace(/\s/g, "").length).toBeGreaterThanOrEqual(10_000);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
  });

  it("never splits an emoji's surrogate pair", () => {
    const chunks = chunkText("😀".repeat(5000));
    for (const chunk of chunks) {
      expect(chunk).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
      expect(() => encodeURIComponent(chunk)).not.toThrow();
    }
  });

  it("a heading starts a new chunk once the current one is half full, with no overlap", () => {
    const intro = paragraph(1, 2000);
    const text = `${intro}\n\n## Returns\n\nReturns are free within 30 days.`;
    expect(chunkText(text)).toEqual([intro, "## Returns\n\nReturns are free within 30 days."]);
  });

  it("a heading inside a paragraph still starts its own block", () => {
    expect(chunkText("Intro line\n# Title\nBody")).toEqual(["Intro line\n\n# Title\nBody"]);
  });

  it("small sections stay together in one chunk", () => {
    const text = "# Shipping\n\nWe ship worldwide.\n\n# Returns\n\n30 days.";
    expect(chunkText(text)).toEqual([text]);
  });

  it("a ~100,000-character paste (the max) gives chunks of about 1,000 tokens", () => {
    const text = Array.from({ length: 100 }, (_, i) => paragraph(i, 995)).join("\n\n");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(25);
    expect(chunks.length).toBeLessThan(35);
  });
});

describe("normalizeText", () => {
  it("drops NULs, unifies line ends and trims trailing spaces", () => {
    expect(normalizeText("a\u0000b  \r\nc\rd\t\n")).toBe("ab\nc\nd");
  });
});
