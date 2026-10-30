// Runs on the customer's page. Import only from `@askwell/shared/embed` (zod-free, keeps us under 5 kB).
import {
  EMBED_PATH,
  HEX_COLOR_PATTERN,
  WIDGET_ANIMATIONS,
  WIDGET_CONFIG_PATH,
  WIDGET_LABEL_MAX_LENGTH,
  WIDGET_POSITIONS,
  isEmbedMessage,
  type EmbedInitMessage,
  type WidgetAnimation,
  type WidgetPosition,
} from "@askwell/shared/embed";
import { widgetCss } from "./styles";

/** The fields of the config route's `config` the loader uses. */
export type LoaderConfig = {
  buttonColor: string;
  position: WidgetPosition;
  label: string;
  animation: WidgetAnimation;
};

const HOST_ATTRIBUTE = "data-askwell";

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return (list as readonly unknown[]).includes(value);
}

/** Checks the config route's body without zod. Anything off → null, and nothing renders. */
export function parseConfig(body: unknown): LoaderConfig | null {
  const config = (body as { config?: Record<string, unknown> } | null)?.config;
  if (typeof config !== "object" || config === null) return null;
  const { buttonColor, position, label, animation } = config;
  if (typeof buttonColor !== "string" || !HEX_COLOR_PATTERN.test(buttonColor)) return null;
  if (!includes(WIDGET_POSITIONS, position) || !includes(WIDGET_ANIMATIONS, animation)) return null;
  if (typeof label !== "string" || !label.trim()) return null;
  return {
    buttonColor,
    position,
    label: label.trim().slice(0, WIDGET_LABEL_MAX_LENGTH),
    animation,
  };
}

async function loadConfig(appOrigin: string, key: string): Promise<LoaderConfig | null> {
  try {
    const url = `${appOrigin}${WIDGET_CONFIG_PATH}?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, { credentials: "omit" });
    return response.status === 200 ? parseConfig(await response.json()) : null;
  } catch {
    return null;
  }
}

/**
 * Reads `data-key` from our own `<script>`, takes the app origin from its `src`, fetches the
 * config and renders the button. Any problem renders nothing and logs nothing.
 * Returns the host element, or null when nothing rendered.
 */
export async function mount(script: Element | null): Promise<HTMLElement | null> {
  if (!(script instanceof HTMLScriptElement)) return null;
  const key = script.dataset.key;
  if (!key || !script.src) return null;
  let appOrigin: string;
  try {
    appOrigin = new URL(script.src).origin;
  } catch {
    return null;
  }
  // An opaque origin ("null") can't be a postMessage target.
  if (appOrigin === "null") return null;

  const config = await loadConfig(appOrigin, key);
  if (!config || document.querySelector(`[${HOST_ATTRIBUTE}]`)) return null;
  if (document.readyState === "loading") {
    await new Promise((resolve) =>
      document.addEventListener("DOMContentLoaded", resolve, { once: true }),
    );
  }
  return render(appOrigin, key, config);
}

function render(appOrigin: string, key: string, config: LoaderConfig): HTMLElement {
  const host = document.createElement("div");
  host.setAttribute(HOST_ATTRIBUTE, "");
  const root = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = widgetCss(config.buttonColor);

  const wrap = document.createElement("div");
  wrap.className = `w ${config.position.replace("-", " ")} ${config.animation}`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "b";
  button.setAttribute("aria-expanded", "false");
  // Text, never HTML (§9 XSS).
  button.append(config.label);
  const badge = document.createElement("span");
  badge.className = "u";
  badge.hidden = true;
  button.append(badge);

  wrap.append(button);
  root.append(style, wrap);
  document.body.append(host);

  let iframe: HTMLIFrameElement | null = null;
  let open = false;
  let unread = 0;

  const showBadge = () => {
    badge.hidden = open || unread === 0;
    badge.textContent = unread > 9 ? "9+" : String(unread);
  };

  const setOpen = (next: boolean) => {
    open = next;
    if (open) unread = 0;
    wrap.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
    showBadge();
  };

  button.addEventListener("click", () => {
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.className = "p";
      iframe.title = config.label;
      iframe.src = `${appOrigin}${EMBED_PATH}?key=${encodeURIComponent(key)}`;
      const frame = iframe;
      frame.addEventListener("load", () => {
        const init: EmbedInitMessage = { type: "askwell:init" };
        frame.contentWindow?.postMessage(init, appOrigin);
      });
      wrap.prepend(frame);
      // Let the closed state paint first, so the open transition runs.
      requestAnimationFrame(() => setOpen(true));
      return;
    }
    setOpen(!open);
  });

  window.addEventListener("message", (event: MessageEvent) => {
    // Only our panel: right origin and the iframe we created (§9 postMessage).
    // `panel` must exist, or a message with `source: null` would match a frame without a window.
    const panel = iframe?.contentWindow;
    if (!iframe || !panel || event.origin !== appOrigin || event.source !== panel) return;
    const message: unknown = event.data;
    if (!isEmbedMessage(message)) return;
    switch (message.type) {
      case "askwell:close":
        setOpen(false);
        break;
      case "askwell:resize":
        iframe.style.height = `${Math.round(message.height)}px`;
        break;
      case "askwell:unread":
        unread = message.count;
        showBadge();
        break;
    }
  });

  return host;
}
