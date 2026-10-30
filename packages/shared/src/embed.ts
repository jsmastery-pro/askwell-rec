// `@askwell/shared/embed`: what the widget loader (on the customer's site) and the panel
// (`/embed`, in the iframe) share. Zod-free: the loader bundles this file and must stay under 5 kB.
// Both sides check `event.origin` and `event.source` before trusting a message, and never post
// to `*` (§9 postMessage).

export * from "./widget-options";

/** The panel page. The loader frames `<appOrigin>/embed?key=pk_...`. */
export const EMBED_PATH = "/embed";

/** The loader fetches `<appOrigin>/api/widget/config?key=pk_...`. */
export const WIDGET_CONFIG_PATH = "/api/widget/config";

export const EMBED_INIT_RETRY_MS = 250;
export const EMBED_INIT_TIMEOUT_MS = 10_000;

/** The visitor's random ID, in the iframe's `localStorage`. */
export const VISITOR_ID_STORAGE_KEY = "askwell:visitor-id";

/**
 * Loader → panel. Its `event.origin` is the host page's origin. Sent when the iframe loads, then
 * every `EMBED_INIT_RETRY_MS` until the panel answers `askwell:ready`, for at most
 * `EMBED_INIT_TIMEOUT_MS` (the panel may start listening after `load`).
 */
export type EmbedInitMessage = { type: "askwell:init" };
/** Panel → loader: init received and its origin stored. Stops the loader's init retries. */
export type EmbedReadyMessage = { type: "askwell:ready" };
/** Panel → loader: hide the panel. */
export type EmbedCloseMessage = { type: "askwell:close" };
/** Panel → loader: the panel's content height in CSS pixels. */
export type EmbedResizeMessage = { type: "askwell:resize"; height: number };
/** Panel → loader: unread bot replies, shown as a badge while the panel is closed. */
export type EmbedUnreadMessage = { type: "askwell:unread"; count: number };

export type LoaderMessage = EmbedInitMessage;
export type PanelMessage =
  EmbedReadyMessage | EmbedCloseMessage | EmbedResizeMessage | EmbedUnreadMessage;
export type EmbedMessage = LoaderMessage | PanelMessage;

export const EMBED_MESSAGE_TYPES = [
  "askwell:init",
  "askwell:ready",
  "askwell:close",
  "askwell:resize",
  "askwell:unread",
] as const satisfies readonly EmbedMessage["type"][];

/** Shape check only. The receiver still checks the sender's origin and source. */
export function isEmbedMessage(data: unknown): data is EmbedMessage {
  if (typeof data !== "object" || data === null) return false;
  const message = data as Record<string, unknown>;
  switch (message.type) {
    case "askwell:init":
    case "askwell:ready":
    case "askwell:close":
      return true;
    case "askwell:resize":
      return (
        typeof message.height === "number" && Number.isFinite(message.height) && message.height >= 0
      );
    case "askwell:unread":
      return Number.isSafeInteger(message.count) && (message.count as number) >= 0;
    default:
      return false;
  }
}
