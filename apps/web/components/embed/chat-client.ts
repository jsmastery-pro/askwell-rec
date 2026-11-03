import {
  ApiErrorSchema,
  WidgetChatRequestSchema,
  WidgetChatResponseSchema,
  type ApiErrorCode,
  type WidgetChatRequest,
  type WidgetChatResponse,
} from "@askwell/shared";

/** A failed chat request, with the API's error code. */
export class ChatRequestError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ChatRequestError";
  }
}

/** Same origin: the panel runs on the app, inside the widget's iframe. */
export const CHAT_ENDPOINT = "/api/widget/chat";

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * `POST /api/widget/chat`. Resolves with the validated reply; anything else (an API error,
 * an unexpected body, a network failure) rejects with a `ChatRequestError`.
 */
export async function sendMessage(request: WidgetChatRequest): Promise<WidgetChatResponse> {
  const parsed = WidgetChatRequestSchema.safeParse(request);
  if (!parsed.success) throw new ChatRequestError("invalid_input", "Invalid message.");

  let response: Response;
  try {
    response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
  } catch {
    throw new ChatRequestError("internal", "Network error.");
  }

  const body = await readJson(response);
  if (!response.ok) {
    const error = ApiErrorSchema.safeParse(body);
    if (error.success) throw new ChatRequestError(error.data.error.code, error.data.error.message);
    throw new ChatRequestError("internal", `Unexpected ${response.status} response.`);
  }

  const reply = WidgetChatResponseSchema.safeParse(body);
  if (!reply.success) throw new ChatRequestError("internal", "Unexpected response.");
  return reply.data;
}

/** What the visitor sees for a failed request. Never the raw server message. */
export function friendlyError(error: unknown): string {
  const code = error instanceof ChatRequestError ? error.code : "internal";
  switch (code) {
    case "rate_limited":
      return "You're sending messages too fast. Try again in a minute.";
    case "quota_exceeded":
      return "This assistant has reached its message limit for this month.";
    case "blocked":
      return "I can't help with that.";
    default:
      return "Something went wrong. Please try again.";
  }
}
