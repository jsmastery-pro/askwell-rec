import "server-only";
import OpenAI from "openai";
import { buildAnswerPrompt, normalizeAnswer, I_DONT_KNOW, type AnswerChunk } from "./prompt";

export { buildAnswerPrompt, I_DONT_KNOW, SYSTEM_PROMPT, type AnswerChunk } from "./prompt";

/** Must match `knowledge_chunks.embedding vector(1536)`. */
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
/** OpenAI's small, cost-efficient chat model (the product owner chose small/mini). */
export const CHAT_MODEL = "gpt-6-luna";

/** Inputs per embeddings request. OpenAI allows 2,048; 100 keeps each request well under its token cap. */
export const EMBED_BATCH_SIZE = 100;

let client: OpenAI | undefined;

/** The only reader of OPENAI_API_KEY. */
function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("openai: missing env OPENAI_API_KEY");
  client = new OpenAI({ apiKey });
  return client;
}

/** One embedding per text, in the same order. Sends batches of `EMBED_BATCH_SIZE`. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBED_BATCH_SIZE);
    const response = await getClient().embeddings.create({
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      input: batch,
    });
    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    if (ordered.length !== batch.length) {
      throw new Error(`embedTexts: got ${ordered.length} embeddings for ${batch.length} texts`);
    }
    for (const { embedding } of ordered) {
      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `embedTexts: embedding has ${embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`,
        );
      }
      embeddings.push(embedding);
    }
  }
  return embeddings;
}

/**
 * The bot's reply to a visitor question, from the retrieved chunks only.
 * No chunks → `I_DONT_KNOW` without calling OpenAI.
 */
export async function answerFromChunks(
  question: string,
  chunks: readonly AnswerChunk[],
): Promise<string> {
  if (chunks.length === 0) return I_DONT_KNOW;

  const { instructions, input } = buildAnswerPrompt(question, chunks);
  const response = await getClient().responses.create({
    model: CHAT_MODEL,
    instructions,
    input,
    reasoning: { effort: "low" },
    store: false,
  });
  return normalizeAnswer(response.output_text);
}
