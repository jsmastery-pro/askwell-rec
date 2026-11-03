import "server-only";
import { PLAN_LIMITS, PlanSchema, type Plan } from "@askwell/shared";
import type { AnswerChunk } from "../ai";
import { createServiceClient } from "../supabase/service";

/** Chunks retrieved per question (project.md §6.6 step 4). */
export const MATCH_CHUNK_COUNT = 5;

/**
 * Cosine similarity below which a chunk doesn't count as related. With text-embedding-3-small,
 * unrelated text scores about 0.0–0.2 and related text about 0.3 and up.
 */
export const MIN_CHUNK_SIMILARITY = 0.3;

export type ChatProject = { id: string; plan: Plan };

/** Thrown by `saveChatTurn` when the conversation isn't in this project. */
export class ConversationNotFoundError extends Error {
  constructor() {
    super("conversation_not_found");
    this.name = "ConversationNotFoundError";
  }
}

/** The project for a public key, with its owner's plan. `null` for an unknown key. */
export async function getChatProject(publicKey: string): Promise<ChatProject | null> {
  // Public routes resolve the project from `public_key` only (project.md §7).
  const { data, error } = await createServiceClient()
    .from("projects")
    .select("id, accounts(plan)")
    .eq("public_key", publicKey)
    .maybeSingle();

  if (error) throw new Error(`getChatProject: ${error.message}`, { cause: error });
  if (!data) return null;
  // An unknown plan value gets Free's limits.
  return { id: data.id, plan: PlanSchema.catch("free").parse(data.accounts?.plan) };
}

/** Whether `conversationId` belongs to this project. Read before anything is counted. */
export async function conversationInProject(
  projectId: string,
  conversationId: string,
): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw new Error(`conversationInProject: ${error.message}`, { cause: error });
  return data !== null;
}

/** Counts one message against the plan's monthly limit. `false` at the limit (nothing counted). */
export async function consumeMessage(project: ChatProject): Promise<boolean> {
  const { data, error } = await createServiceClient().rpc("consume_message", {
    p_project_id: project.id,
    p_limit: PLAN_LIMITS[project.plan].messagesPerMonthPerProject,
  });

  if (error) throw new Error(`consumeMessage: ${error.message}`, { cause: error });
  return data === true;
}

/** This project's ready chunks closest to the embedding, at or above `MIN_CHUNK_SIMILARITY`. */
export async function matchChunks(projectId: string, embedding: number[]): Promise<AnswerChunk[]> {
  const { data, error } = await createServiceClient().rpc("match_chunks", {
    p_project_id: projectId,
    // pgvector's text form, `[0.1,0.2,…]`.
    p_embedding: JSON.stringify(embedding),
    p_count: MATCH_CHUNK_COUNT,
  });

  if (error) throw new Error(`matchChunks: ${error.message}`, { cause: error });
  return (data ?? [])
    .filter((chunk) => chunk.similarity >= MIN_CHUNK_SIMILARITY)
    .map(({ content }) => ({ content }));
}

/** Saves the visitor message and the reply. Creates the conversation when `conversationId` is null. */
export async function saveChatTurn(turn: {
  projectId: string;
  conversationId: string | null;
  visitorId: string;
  visitorBody: string;
  botBody: string;
}): Promise<string> {
  const { data, error } = await createServiceClient().rpc("save_chat_turn", {
    p_project_id: turn.projectId,
    // The generated types say `string`; the function takes null for a new conversation.
    p_conversation_id: turn.conversationId as string,
    p_visitor_id: turn.visitorId,
    p_visitor_body: turn.visitorBody,
    p_bot_body: turn.botBody,
  });

  if (error?.code === "P0001" && error.message === "conversation_not_found") {
    throw new ConversationNotFoundError();
  }
  if (error) throw new Error(`saveChatTurn: ${error.message}`, { cause: error });
  return data;
}
