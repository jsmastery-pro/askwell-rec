import { z } from "zod";
import { KNOWLEDGE_FILE_TYPES } from "./limits";

// API shapes (camelCase). Timestamps are ISO 8601 strings.
const Timestamp = z.iso.datetime({ offset: true });

export const PUBLIC_KEY_PREFIX = "pk_";
export const PublicKeySchema = z.string().regex(/^pk_[A-Za-z0-9_-]{8,128}$/, "Invalid public key");

export const ProjectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  publicKey: PublicKeySchema,
  messagesUsed: z.number().int().nonnegative(),
  periodStart: Timestamp,
  createdAt: Timestamp,
});
export type Project = z.infer<typeof ProjectSchema>;

export const KNOWLEDGE_SOURCE_TYPES = ["text", ...KNOWLEDGE_FILE_TYPES] as const;
export const KnowledgeSourceTypeSchema = z.enum(KNOWLEDGE_SOURCE_TYPES);
export type KnowledgeSourceType = z.infer<typeof KnowledgeSourceTypeSchema>;

export const KNOWLEDGE_SOURCE_STATUSES = ["uploading", "processing", "ready", "failed"] as const;
export const KnowledgeSourceStatusSchema = z.enum(KNOWLEDGE_SOURCE_STATUSES);
export type KnowledgeSourceStatus = z.infer<typeof KnowledgeSourceStatusSchema>;

export const KnowledgeSourceSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  title: z.string(),
  type: KnowledgeSourceTypeSchema,
  status: KnowledgeSourceStatusSchema,
  createdAt: Timestamp,
});
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

export const ConversationSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  visitorId: z.string(),
  createdAt: Timestamp,
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const MESSAGE_ROLES = ["visitor", "bot"] as const;
export const MessageRoleSchema = z.enum(MESSAGE_ROLES);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  role: MessageRoleSchema,
  body: z.string(),
  createdAt: Timestamp,
});
export type Message = z.infer<typeof MessageSchema>;
