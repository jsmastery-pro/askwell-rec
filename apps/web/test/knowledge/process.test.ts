import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_ID } from "../projects/stub";
import { SOURCE_ID } from "../knowledge-ui/stub";
import { makePdf } from "./pdf";

vi.mock("server-only", () => ({}));

const embedTexts = vi.hoisted(() => vi.fn<(texts: string[]) => Promise<number[][]>>());
vi.mock("../../lib/ai", () => ({ embedTexts }));

const serviceFetch = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock("../../lib/supabase/service", async () => {
  const { stubClient } = await import("../projects/stub");
  return { createServiceClient: () => stubClient(serviceFetch) };
});

const { CHUNK_INSERT_BATCH, processFileSource, processSource } =
  await import("../../lib/knowledge");

const fakeEmbedding = (i: number) => [i, 0.5];

/** Every request the service client made, as method + path + filters + body. */
function requests() {
  return serviceFetch.mock.calls.map(([input, init]) => {
    const url = new URL(String(input));
    return {
      method: init?.method ?? "GET",
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
    };
  });
}

describe("processSource", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    embedTexts.mockReset();
    embedTexts.mockImplementation(async (texts) => texts.map((_, i) => fakeEmbedding(i)));
    serviceFetch.mockReset();
    serviceFetch.mockImplementation(async () => new Response(null, { status: 201 }));
  });

  it("chunks, embeds, inserts the chunks for this source and project, then marks it ready", async () => {
    expect(await processSource(SOURCE_ID, PROJECT_ID, "# FAQ\n\nWe ship worldwide.")).toBe("ready");

    expect(embedTexts).toHaveBeenCalledWith(["# FAQ\n\nWe ship worldwide."]);
    const [insert, ready] = requests();
    expect(insert).toMatchObject({ method: "POST", path: "/rest/v1/knowledge_chunks" });
    expect(insert!.body).toEqual([
      {
        project_id: PROJECT_ID,
        source_id: SOURCE_ID,
        content: "# FAQ\n\nWe ship worldwide.",
        embedding: "[0,0.5]",
      },
    ]);
    expect(ready).toMatchObject({
      method: "PATCH",
      path: "/rest/v1/knowledge_sources",
      query: { id: `eq.${SOURCE_ID}`, project_id: `eq.${PROJECT_ID}` },
      body: { status: "ready" },
    });
    expect(requests()).toHaveLength(2);
  });

  it(`inserts in batches of ${CHUNK_INSERT_BATCH}, keeping each chunk with its embedding`, async () => {
    // ~250 chunks: 250 paragraphs that each fill most of a chunk.
    const text = Array.from({ length: 250 }, (_, i) => `P${i} ${"word ".repeat(700)}`).join("\n\n");
    expect(await processSource(SOURCE_ID, PROJECT_ID, text)).toBe("ready");

    const inserts = requests().filter((r) => r.method === "POST");
    const rows = inserts.flatMap((r) => r.body as { content: string; embedding: string }[]);
    expect(inserts.map((r) => (r.body as unknown[]).length)).toEqual([100, 100, 50]);
    rows.forEach((row, i) => {
      expect(row.embedding).toBe(JSON.stringify(fakeEmbedding(i)));
      expect(row.content).toContain(`P${i} `);
    });
  });

  it("an embedding error deletes the source's chunks and marks it failed, without throwing", async () => {
    embedTexts.mockRejectedValueOnce(new Error("openai down"));
    expect(await processSource(SOURCE_ID, PROJECT_ID, "Some text")).toBe("failed");

    expect(requests()).toEqual([
      {
        method: "DELETE",
        path: "/rest/v1/knowledge_chunks",
        query: { source_id: `eq.${SOURCE_ID}`, project_id: `eq.${PROJECT_ID}` },
        body: undefined,
      },
      {
        method: "PATCH",
        path: "/rest/v1/knowledge_sources",
        query: { id: `eq.${SOURCE_ID}`, project_id: `eq.${PROJECT_ID}` },
        body: { status: "failed" },
      },
    ]);
  });

  it("a failed insert after an earlier batch removes the chunks already saved", async () => {
    const text = Array.from({ length: 150 }, (_, i) => `P${i} ${"word ".repeat(700)}`).join("\n\n");
    serviceFetch
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ message: "boom" }, { status: 500 }));

    expect(await processSource(SOURCE_ID, PROJECT_ID, text)).toBe("failed");
    expect(requests().map((r) => `${r.method} ${r.path}`)).toEqual([
      "POST /rest/v1/knowledge_chunks",
      "POST /rest/v1/knowledge_chunks",
      "DELETE /rest/v1/knowledge_chunks",
      "PATCH /rest/v1/knowledge_sources",
    ]);
  });

  it("text with nothing to index fails without calling OpenAI", async () => {
    expect(await processSource(SOURCE_ID, PROJECT_ID, " \n\u0000 ")).toBe("failed");
    expect(embedTexts).not.toHaveBeenCalled();
    expect(requests().at(-1)?.body).toEqual({ status: "failed" });
  });

  it("an error while marking it failed is logged, not thrown", async () => {
    embedTexts.mockRejectedValueOnce(new Error("openai down"));
    serviceFetch.mockResolvedValue(Response.json({ message: "db down" }, { status: 500 }));
    await expect(processSource(SOURCE_ID, PROJECT_ID, "Some text")).resolves.toBe("failed");
  });
});

describe("processFileSource", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    embedTexts.mockReset();
    embedTexts.mockImplementation(async (texts) => texts.map((_, i) => fakeEmbedding(i)));
    serviceFetch.mockReset();
    serviceFetch.mockImplementation(async () => new Response(null, { status: 201 }));
  });

  it("extracts a PDF's text, then processes it", async () => {
    expect(
      await processFileSource(SOURCE_ID, PROJECT_ID, makePdf("Refunds take 5 days."), "pdf"),
    ).toBe("ready");
    expect(embedTexts.mock.calls[0]![0].join(" ")).toContain("Refunds take 5 days.");
  });

  it("a file that fails extraction is marked failed", async () => {
    const notPdf = new TextEncoder().encode("not a pdf");
    expect(await processFileSource(SOURCE_ID, PROJECT_ID, notPdf, "pdf")).toBe("failed");
    expect(embedTexts).not.toHaveBeenCalled();
    expect(requests().at(-1)?.body).toEqual({ status: "failed" });
  });
});
