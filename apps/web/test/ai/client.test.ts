import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const openai = vi.hoisted(() => ({
  options: [] as unknown[],
  embeddingsCreate: vi.fn(),
  responsesCreate: vi.fn(),
}));
vi.mock("openai", () => ({
  default: class {
    embeddings = { create: openai.embeddingsCreate };
    responses = { create: openai.responsesCreate };
    constructor(options: unknown) {
      openai.options.push(options);
    }
  },
}));

vi.stubEnv("OPENAI_API_KEY", "sk-test");

const ai = await import("../../lib/ai");

const vector = (seed: number) => Array.from({ length: 1536 }, () => seed);

/** An embeddings response for `input`, returned out of order to check sorting. */
function embeddingsFor({ input }: { input: string[] }) {
  return Promise.resolve({
    data: input.map((text, index) => ({ index, embedding: vector(Number(text)) })).reverse(),
  });
}

describe("models", () => {
  it("embedding model matches vector(1536)", () => {
    expect(ai.EMBEDDING_MODEL).toBe("text-embedding-3-small");
    expect(ai.EMBEDDING_DIMENSIONS).toBe(1536);
  });
});

describe("embedTexts", () => {
  beforeEach(() => {
    openai.embeddingsCreate.mockReset();
    openai.embeddingsCreate.mockImplementation(embeddingsFor);
  });

  it("returns [] for no texts, without calling OpenAI", async () => {
    expect(await ai.embedTexts([])).toEqual([]);
    expect(openai.embeddingsCreate).not.toHaveBeenCalled();
  });

  it("batches by EMBED_BATCH_SIZE and keeps the input order", async () => {
    const texts = Array.from({ length: ai.EMBED_BATCH_SIZE * 2 + 5 }, (_, i) => String(i));
    const result = await ai.embedTexts(texts);

    expect(openai.embeddingsCreate).toHaveBeenCalledTimes(3);
    const sizes = openai.embeddingsCreate.mock.calls.map(([body]) => body.input.length);
    expect(sizes).toEqual([ai.EMBED_BATCH_SIZE, ai.EMBED_BATCH_SIZE, 5]);
    for (const [body] of openai.embeddingsCreate.mock.calls) {
      expect(body).toMatchObject({ model: "text-embedding-3-small", dimensions: 1536 });
    }
    expect(result.map((embedding) => embedding[0])).toEqual(texts.map(Number));
  });

  it("throws on an embedding of the wrong size", async () => {
    openai.embeddingsCreate.mockResolvedValueOnce({ data: [{ index: 0, embedding: [1, 2] }] });
    await expect(ai.embedTexts(["1"])).rejects.toThrow(/expected 1536/);
  });

  it("reads OPENAI_API_KEY for the client", async () => {
    await ai.embedTexts(["1"]);
    expect(openai.options).toEqual([{ apiKey: "sk-test" }]);
  });
});

describe("answerFromChunks", () => {
  beforeEach(() => {
    openai.responsesCreate.mockReset();
  });

  it("no chunks → I don't know, without calling OpenAI", async () => {
    expect(await ai.answerFromChunks("Anything?", [])).toBe(ai.I_DONT_KNOW);
    expect(openai.responsesCreate).not.toHaveBeenCalled();
  });

  it("sends the built prompt to the chat model and returns the reply", async () => {
    openai.responsesCreate.mockResolvedValueOnce({ output_text: " 3 days. " });
    const chunks = [{ content: "Shipping takes 3 days." }];

    expect(await ai.answerFromChunks("How long is shipping?", chunks)).toBe("3 days.");
    const prompt = ai.buildAnswerPrompt("How long is shipping?", chunks);
    expect(openai.responsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: ai.CHAT_MODEL,
        instructions: prompt.instructions,
        input: prompt.input,
        store: false,
      }),
    );
  });

  it("normalizes the model's I don't know", async () => {
    openai.responsesCreate.mockResolvedValueOnce({ output_text: "I don’t know." });
    expect(await ai.answerFromChunks("Unrelated?", [{ content: "x" }])).toBe("I don't know");
  });
});
