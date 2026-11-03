import "server-only";
import arcjet, {
  detectPromptInjection,
  shield,
  slidingWindow,
  type ArcjetDecision,
} from "@arcjet/next";

/** project.md §6.6 step 1: 20 messages per minute per public key + IP. */
export const WIDGET_CHAT_RATE_LIMIT = { max: 20, interval: "1m" } as const;

export type WidgetChatProtection =
  | { outcome: "allowed" }
  | { outcome: "rate_limited"; retryAfterSeconds: number }
  | { outcome: "blocked"; reason: "prompt_injection" | "other" };

/** The only reader of ARCJET_KEY. */
function createWidgetChatClient() {
  const key = process.env.ARCJET_KEY;
  if (!key) throw new Error("arcjet: missing env ARCJET_KEY");

  return arcjet({ key, rules: [shield({ mode: "LIVE" })] })
    .withRule(
      slidingWindow({
        mode: "LIVE",
        // A custom `publicKey` characteristic plus the IP, not IP alone: a visitor's count on
        // one site never spends their budget on another site.
        characteristics: ["publicKey", "ip.src"],
        interval: WIDGET_CHAT_RATE_LIMIT.interval,
        max: WIDGET_CHAT_RATE_LIMIT.max,
      }),
    )
    .withRule(detectPromptInjection({ mode: "LIVE" }));
}

let widgetChat: ReturnType<typeof createWidgetChatClient> | undefined;

/** Maps an Arcjet decision to the chat route's outcome. An errored decision fails open. */
export function toWidgetChatProtection(decision: ArcjetDecision): WidgetChatProtection {
  if (decision.isErrored()) {
    console.warn("arcjet: decision errored, allowing", decision.reason.message);
    return { outcome: "allowed" };
  }
  if (!decision.isDenied()) return { outcome: "allowed" };

  if (decision.reason.isRateLimit()) {
    return { outcome: "rate_limited", retryAfterSeconds: decision.reason.reset };
  }
  if (decision.reason.isPromptInjection()) {
    return { outcome: "blocked", reason: "prompt_injection" };
  }
  return { outcome: "blocked", reason: "other" };
}

/**
 * Arcjet for `POST /api/widget/chat` (step 1): Shield, the per-key-and-IP rate limit, and
 * prompt-injection detection on the visitor's message. Call once per request, before any
 * other work: each call counts toward the limit.
 */
export async function protectWidgetChat(
  request: Request,
  { publicKey, message }: { publicKey: string; message: string },
): Promise<WidgetChatProtection> {
  widgetChat ??= createWidgetChatClient();
  const decision = await widgetChat.protect(request, {
    publicKey,
    detectPromptInjectionMessage: message,
  });
  return toWidgetChatProtection(decision);
}
