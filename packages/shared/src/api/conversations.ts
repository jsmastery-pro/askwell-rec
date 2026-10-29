import { z } from "zod";
import { ConversationSchema, MessageSchema } from "../entities";
import { EmptyRequestSchema } from "./common";

// GET /api/projects/:id/conversations (newest first)
export const ListConversationsRequestSchema = EmptyRequestSchema;
export type ListConversationsRequest = z.infer<typeof ListConversationsRequestSchema>;

export const ConversationSummarySchema = ConversationSchema.extend({
  /** Start of the first visitor message. */
  preview: z.string(),
  messageCount: z.number().int().nonnegative(),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export const ListConversationsResponseSchema = z.object({
  conversations: z.array(ConversationSummarySchema),
});
export type ListConversationsResponse = z.infer<typeof ListConversationsResponseSchema>;

// GET /api/conversations/:id (oldest message first)
export const GetConversationRequestSchema = EmptyRequestSchema;
export type GetConversationRequest = z.infer<typeof GetConversationRequestSchema>;

export const GetConversationResponseSchema = z.object({
  conversation: ConversationSchema,
  messages: z.array(MessageSchema),
});
export type GetConversationResponse = z.infer<typeof GetConversationResponseSchema>;
