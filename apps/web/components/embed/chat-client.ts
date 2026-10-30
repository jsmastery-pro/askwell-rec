import {
  WidgetChatRequestSchema,
  type ApiErrorCode,
  type WidgetChatRequest,
  type WidgetChatResponse,
} from "@askwell/shared";

/** A failed chat request, with the API's error code. Phase 3's real client throws the same. */
export class ChatRequestError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ChatRequestError";
  }
}

export const MOCK_REPLY_DELAY_MS = 800;

export const MOCK_REPLY =
  "Thanks for your message! This chat is in preview, so this is a sample reply. Real answers are coming soon.";

/** Send one of these as the message to see the panel's error states (Phase 2 only). */
export const SIMULATED_ERRORS = {
  "/simulate rate_limited": "rate_limited",
  "/simulate quota_exceeded": "quota_exceeded",
} as const satisfies Record<string, ApiErrorCode>;

function isSimulatedError(message: string): message is keyof typeof SIMULATED_ERRORS {
  return Object.hasOwn(SIMULATED_ERRORS, message);
}

/**
 * Phase 2 mock of `POST /api/widget/chat`: waits ~800 ms, then returns a canned reply.
 * Phase 3 replaces only this function's body with the real request.
 */
export async function sendMessage(request: WidgetChatRequest): Promise<WidgetChatResponse> {
  const parsed = WidgetChatRequestSchema.safeParse(request);
  if (!parsed.success) throw new ChatRequestError("invalid_input", "Invalid message.");

  await new Promise((resolve) => setTimeout(resolve, MOCK_REPLY_DELAY_MS));

  const { message, conversationId } = parsed.data;
  if (isSimulatedError(message)) {
    throw new ChatRequestError(SIMULATED_ERRORS[message], "Simulated error.");
  }
  return { conversationId: conversationId ?? crypto.randomUUID(), reply: MOCK_REPLY };
}

/** What the visitor sees for a failed request. Never the raw server message. */
export function friendlyError(error: unknown): string {
  const code = error instanceof ChatRequestError ? error.code : "internal";
  switch (code) {
    case "rate_limited":
      return "You're sending messages a little fast. Wait a moment, then try again.";
    case "quota_exceeded":
      return "This chat can't take new messages right now. Please try again later.";
    default:
      return "Something went wrong. Please try again.";
  }
}
