import { z } from "zod";
import { KnowledgeSourceSchema } from "../entities";
import { DeletedResponseSchema, EmptyRequestSchema } from "./common";
import {
  KNOWLEDGE_FILE_MAX_BYTES,
  KNOWLEDGE_FILE_TYPES,
  KNOWLEDGE_TEXT_MAX_LENGTH,
} from "../limits";

export const KNOWLEDGE_TITLE_MAX_LENGTH = 200;

const fileExtension = new RegExp(`\\.(${KNOWLEDGE_FILE_TYPES.join("|")})$`, "i");

// POST /api/projects/:id/knowledge (pasted text)
export const CreateKnowledgeTextRequestSchema = z.object({
  title: z.string().trim().min(1).max(KNOWLEDGE_TITLE_MAX_LENGTH),
  content: z.string().trim().min(1).max(KNOWLEDGE_TEXT_MAX_LENGTH),
});
export type CreateKnowledgeTextRequest = z.infer<typeof CreateKnowledgeTextRequestSchema>;

export const CreateKnowledgeTextResponseSchema = z.object({ source: KnowledgeSourceSchema });
export type CreateKnowledgeTextResponse = z.infer<typeof CreateKnowledgeTextResponseSchema>;

// POST /api/projects/:id/knowledge/upload-url
// Declared name and size only; finalize checks the real file.
export const CreateUploadUrlRequestSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(KNOWLEDGE_TITLE_MAX_LENGTH)
    .regex(fileExtension, `Allowed file types: ${KNOWLEDGE_FILE_TYPES.join(", ")}`),
  sizeBytes: z.number().int().positive().max(KNOWLEDGE_FILE_MAX_BYTES),
});
export type CreateUploadUrlRequest = z.infer<typeof CreateUploadUrlRequestSchema>;

/** `source.status` is `uploading`. `uploadUrl` is a one-time signed Storage URL. */
export const CreateUploadUrlResponseSchema = z.object({
  source: KnowledgeSourceSchema,
  uploadUrl: z.url(),
});
export type CreateUploadUrlResponse = z.infer<typeof CreateUploadUrlResponseSchema>;

// POST /api/projects/:id/knowledge/finalize
export const FinalizeUploadRequestSchema = z.object({ sourceId: z.uuid() });
export type FinalizeUploadRequest = z.infer<typeof FinalizeUploadRequestSchema>;

export const FinalizeUploadResponseSchema = z.object({ source: KnowledgeSourceSchema });
export type FinalizeUploadResponse = z.infer<typeof FinalizeUploadResponseSchema>;

// DELETE /api/knowledge/:id (source, file and chunks)
export const DeleteKnowledgeRequestSchema = EmptyRequestSchema;
export type DeleteKnowledgeRequest = z.infer<typeof DeleteKnowledgeRequestSchema>;

export const DeleteKnowledgeResponseSchema = DeletedResponseSchema;
export type DeleteKnowledgeResponse = z.infer<typeof DeleteKnowledgeResponseSchema>;
