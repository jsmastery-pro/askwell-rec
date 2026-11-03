import type { Tables } from "@askwell/db";
import {
  KnowledgeSourceStatusSchema,
  KnowledgeSourceTypeSchema,
  type KnowledgeSource,
} from "@askwell/shared";

/** The `knowledge_sources` columns a `KnowledgeSource` is built from. Never `storage_key`. */
export const KNOWLEDGE_SOURCE_COLUMNS = "id, project_id, title, type, status, created_at";

export type KnowledgeSourceRow = Pick<
  Tables<"knowledge_sources">,
  "id" | "project_id" | "title" | "type" | "status" | "created_at"
>;

export function toKnowledgeSource(row: KnowledgeSourceRow): KnowledgeSource {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    type: KnowledgeSourceTypeSchema.parse(row.type),
    status: KnowledgeSourceStatusSchema.parse(row.status),
    createdAt: row.created_at,
  };
}

/**
 * An `uploading` reservation older than this is reclaimed by the next reserve
 * (reserve_knowledge_source), so the page neither lists nor counts it.
 */
export const STALE_UPLOAD_MS = 2 * 60 * 60 * 1000;

/** PostgREST `or` filter that leaves out stale reservations, as of `now`. */
export const notStaleUpload = (now = Date.now()) =>
  `status.neq.uploading,created_at.gte.${new Date(now - STALE_UPLOAD_MS).toISOString()}`;

export const isProcessing = (source: Pick<KnowledgeSource, "status">) =>
  source.status === "uploading" || source.status === "processing";
