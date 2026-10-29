import { z } from "zod";

export const MESSAGE_MAX_LENGTH = 1000;

export const KNOWLEDGE_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const KNOWLEDGE_TEXT_MAX_LENGTH = 100_000;

export const KNOWLEDGE_FILE_TYPES = ["pdf", "md", "txt"] as const;
export const KnowledgeFileTypeSchema = z.enum(KNOWLEDGE_FILE_TYPES);
export type KnowledgeFileType = z.infer<typeof KnowledgeFileTypeSchema>;

/** MIME types per file type, for the Storage bucket's allow list and the upload's Content-Type. */
export const KNOWLEDGE_FILE_MIME_TYPES = {
  pdf: "application/pdf",
  md: "text/markdown",
  txt: "text/plain",
} as const satisfies Record<KnowledgeFileType, string>;
