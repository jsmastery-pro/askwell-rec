import {
  API_ERROR_STATUS,
  WidgetChatRequestSchema,
  type ApiError,
  type ApiErrorCode,
  type WidgetChatResponse,
} from "@askwell/shared";
import { NextResponse, type NextRequest } from "next/server";
import { I_DONT_KNOW, answerFromChunks, embedTexts } from "../../../../lib/ai";
import { protectWidgetChat } from "../../../../lib/arcjet";
import {
  ConversationNotFoundError,
  consumeMessage,
  conversationInProject,
  getChatProject,
  matchChunks,
  saveChatTurn,
} from "../../../../lib/chat";

// Called by the panel, and open to any origin like every public widget route (project.md §9
// CORS). No credentials. Never cached.
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

function errorResponse(code: ApiErrorCode, message: string, headers?: Record<string, string>) {
  const body: ApiError = { error: { code, message } };
  return NextResponse.json(body, {
    status: API_ERROR_STATUS[code],
    headers: { ...HEADERS, ...headers },
  });
}

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** project.md §6.6, steps 1–6 in order. */
export async function POST(request: NextRequest) {
  const body = await readBody(request);

  // 1. Protect, before anything else: a malformed request still counts toward the rate limit.
  // A refused message never reaches OpenAI. Arcjet fails open on its own errors; a setup error
  // (e.g. no ARCJET_KEY) fails closed.
  let protection;
  try {
    protection = await protectWidgetChat(request, {
      publicKey: text(body.key),
      message: text(body.message),
    });
  } catch (error) {
    console.error(error);
    return errorResponse("internal", "Could not send the message.");
  }
  if (protection.outcome === "rate_limited") {
    return errorResponse(
      "rate_limited",
      "Too many messages. Try again in a minute.",
      protection.retryAfterSeconds > 0
        ? { "Retry-After": String(protection.retryAfterSeconds) }
        : undefined,
    );
  }
  if (protection.outcome === "blocked") return errorResponse("blocked", "Message refused.");

  // 2. Validate. Nothing is counted for a bad key or someone else's conversation.
  const parsed = WidgetChatRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("invalid_input", "Invalid message.");
  const { key, visitorId, conversationId, message } = parsed.data;

  let project;
  try {
    project = await getChatProject(key);
    if (!project) return errorResponse("not_found", "Unknown public key.");
    if (conversationId && !(await conversationInProject(project.id, conversationId))) {
      return errorResponse("not_found", "Unknown conversation.");
    }

    // 3. Count, before any OpenAI call. From here on the message stays counted, even on error.
    if (!(await consumeMessage(project))) {
      return errorResponse("quota_exceeded", "This project has used its messages for the month.");
    }
  } catch (error) {
    console.error(error);
    return errorResponse("internal", "Could not send the message.");
  }

  let reply: string;
  try {
    // 4. Retrieve this project's closest ready chunks.
    const [embedding] = await embedTexts([message]);
    const chunks = await matchChunks(project.id, embedding!);
    // 5. Answer from them only. No related chunk → no model call.
    reply = chunks.length === 0 ? I_DONT_KNOW : await answerFromChunks(message, chunks);
  } catch (error) {
    console.error(error);
    return errorResponse("internal", "Could not answer the message.");
  }

  // 6. Save the turn; the first message creates the conversation.
  try {
    const savedId = await saveChatTurn({
      projectId: project.id,
      conversationId: conversationId ?? null,
      visitorId,
      visitorBody: message,
      botBody: reply,
    });
    const response: WidgetChatResponse = { conversationId: savedId, reply };
    return NextResponse.json(response, { headers: HEADERS });
  } catch (error) {
    // Backstop for the step 2 check, e.g. a conversation deleted mid-request.
    if (error instanceof ConversationNotFoundError) {
      return errorResponse("not_found", "Unknown conversation.");
    }
    console.error(error);
    return errorResponse("internal", "Could not save the message.");
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}
