import "server-only";
import type { KnowledgeFileType } from "@askwell/shared";
import { embedTexts } from "../ai";
import { createServiceClient } from "../supabase/service";
import { chunkText } from "./chunk";
import { extractText } from "./extract";

/** Rows per knowledge_chunks insert: 100 embeddings are about 2 MB of JSON. */
export const CHUNK_INSERT_BATCH = 100;

export type ProcessResult = "ready" | "failed";

/**
 * Pasted text → chunks → embeddings → knowledge_chunks, then the source is `ready`.
 * On any error its chunks are deleted and it is `failed`. Never throws, so it can run in
 * `after()`. The caller has already checked that the project is the owner's.
 */
export function processSource(
  sourceId: string,
  projectId: string,
  text: string,
): Promise<ProcessResult> {
  return run(sourceId, projectId, async () => text);
}

/** The same for an uploaded file (finalize): extracting its text is part of the work. */
export function processFileSource(
  sourceId: string,
  projectId: string,
  bytes: Uint8Array,
  type: KnowledgeFileType,
): Promise<ProcessResult> {
  return run(sourceId, projectId, () => extractText(bytes, type));
}

async function run(
  sourceId: string,
  projectId: string,
  getText: () => Promise<string>,
): Promise<ProcessResult> {
  // Service client: the background step writes rows owners can't (§7).
  const db = createServiceClient();
  try {
    const chunks = chunkText(await getText());
    if (chunks.length === 0) throw new Error("no text to index");

    const embeddings = await embedTexts(chunks);
    for (let start = 0; start < chunks.length; start += CHUNK_INSERT_BATCH) {
      const rows = chunks.slice(start, start + CHUNK_INSERT_BATCH).map((content, i) => ({
        project_id: projectId,
        source_id: sourceId,
        content,
        // pgvector's text form, "[0.1,0.2,…]".
        embedding: JSON.stringify(embeddings[start + i]),
      }));
      const { error } = await db.from("knowledge_chunks").insert(rows);
      if (error) throw new Error(`insert chunks: ${error.message}`, { cause: error });
    }

    const { error } = await db
      .from("knowledge_sources")
      .update({ status: "ready" })
      .eq("id", sourceId)
      .eq("project_id", projectId);
    if (error) throw new Error(`mark ready: ${error.message}`, { cause: error });
    return "ready";
  } catch (error) {
    console.error(`processSource ${sourceId}:`, error);
    await markFailed(db, sourceId, projectId);
    return "failed";
  }
}

async function markFailed(
  db: ReturnType<typeof createServiceClient>,
  sourceId: string,
  projectId: string,
) {
  const chunks = await db
    .from("knowledge_chunks")
    .delete()
    .eq("source_id", sourceId)
    .eq("project_id", projectId);
  const source = await db
    .from("knowledge_sources")
    .update({ status: "failed" })
    .eq("id", sourceId)
    .eq("project_id", projectId);
  for (const { error } of [chunks, source]) {
    if (error) console.error(`processSource ${sourceId}: marking failed:`, error);
  }
}
