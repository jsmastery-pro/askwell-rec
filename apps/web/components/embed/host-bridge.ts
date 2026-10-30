import { isEmbedMessage, type PanelMessage } from "@askwell/shared/embed";

export type HostBridge = {
  /** Posts to the host page, only once `askwell:init` gave us its origin. Never to `*`. */
  send: (message: PanelMessage) => void;
  /** The host page's origin from `askwell:init`, or null before it. */
  hostOrigin: () => string | null;
  dispose: () => void;
};

/**
 * The panel's side of the loader protocol (§9 postMessage). Accepts `askwell:init` only from
 * `window.parent` and stores that message's origin as the host origin. The first one wins, so a
 * later message can't redirect us. Everything we send goes to that origin only.
 * Each accepted init is answered with `askwell:ready`, which stops the loader's init retries
 * (we may have started listening after the iframe's `load`, so the first init can be lost).
 */
export function createHostBridge(win: Window = window): HostBridge {
  let hostOrigin: string | null = null;

  const onMessage = (event: MessageEvent) => {
    // Not framed (`parent === window`), or not from our parent → ignore.
    if (win.parent === win || event.source !== win.parent) return;
    if (!isEmbedMessage(event.data) || event.data.type !== "askwell:init") return;
    if (hostOrigin === null) {
      // An opaque origin ("null") can't be a postMessage target.
      if (event.origin === "null" || !event.origin) return;
      hostOrigin = event.origin;
    } else if (event.origin !== hostOrigin) {
      return;
    }
    // Also for a repeat init from the same origin: a retry can cross our first ready.
    win.parent.postMessage({ type: "askwell:ready" } satisfies PanelMessage, hostOrigin);
  };
  win.addEventListener("message", onMessage);

  return {
    send(message) {
      if (hostOrigin !== null) win.parent.postMessage(message, hostOrigin);
    },
    hostOrigin: () => hostOrigin,
    dispose: () => win.removeEventListener("message", onMessage),
  };
}

/**
 * The panel's bridge, listening from the moment this module first loads in the browser (before
 * React hydrates), so an early `askwell:init` isn't missed. `null` during server rendering.
 * It lives as long as the iframe's document.
 */
export const hostBridge: HostBridge | null =
  typeof window === "undefined" ? null : createHostBridge(window);
