import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, parseConfig, type LoaderConfig } from "../src/loader";
import { textColorFor } from "../src/styles";

const APP_ORIGIN = "https://app.askwell.test";
const KEY = "pk_test_abc12345";
const CONFIG: LoaderConfig = {
  buttonColor: "#112233",
  position: "bottom-right",
  label: "Chat with us",
  animation: "slide",
};

const fetchMock = vi.fn<typeof fetch>();

function script({
  key = KEY,
  src = `${APP_ORIGIN}/widget.js`,
}: { key?: string | null; src?: string } = {}) {
  const el = document.createElement("script");
  el.src = src;
  if (key !== null) el.dataset.key = key;
  return el;
}

function serve(body: unknown, status = 200) {
  fetchMock.mockResolvedValue(Response.json(body, { status }));
}

/** Mounts with a good config and returns the shadow root's parts. */
async function mounted(config: Partial<LoaderConfig> = {}) {
  serve({ config: { ...CONFIG, headerText: "How can we help?", showBadge: true, ...config } });
  const host = await mount(script());
  if (!host?.shadowRoot) throw new Error("widget did not mount");
  const root = host.shadowRoot;
  const button = root.querySelector("button")!;
  const wrap = root.querySelector(".w")!;
  const badge = root.querySelector<HTMLElement>(".u")!;
  return { host, root, button, wrap, badge };
}

/**
 * jsdom gives an iframe inside a shadow root no window (browsers do), so the panel borrows a real
 * jsdom Window from a helper iframe in the light DOM. MessageEvent only accepts a real one as `source`.
 */
function giveWindow(iframe: HTMLIFrameElement): Window {
  const helper = document.createElement("iframe");
  document.body.append(helper);
  const frameWindow = helper.contentWindow!;
  Object.defineProperty(iframe, "contentWindow", { configurable: true, get: () => frameWindow });
  return frameWindow;
}

async function openPanel(button: HTMLButtonElement, root: ShadowRoot) {
  button.click();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const iframe = root.querySelector("iframe")!;
  giveWindow(iframe);
  return iframe;
}

function post(
  data: unknown,
  { origin = APP_ORIGIN, source }: { origin?: string; source: MessageEventSource | null },
) {
  window.dispatchEvent(new MessageEvent("message", { data, origin, source }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.head.replaceChildren();
});

describe("mount: script and config", () => {
  it("reads data-key and fetches the config from the script's own origin", async () => {
    serve({ config: CONFIG });
    await mount(script({ src: `${APP_ORIGIN}/widget.js?v=1` }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(`${APP_ORIGIN}/api/widget/config?key=${KEY}`);
    expect(fetchMock.mock.calls[0]![1]).toEqual({ credentials: "omit" });
  });

  it("URL-encodes the key", async () => {
    serve({ config: CONFIG });
    await mount(script({ key: "pk_a&b=c" }));
    expect(fetchMock.mock.calls[0]![0]).toBe(`${APP_ORIGIN}/api/widget/config?key=pk_a%26b%3Dc`);
  });

  it.each([
    ["no script", null],
    ["no data-key", "no-key"],
    ["an empty data-key", "empty-key"],
    ["a non-script element", "div"],
  ])("does nothing with %s", async (_name, kind) => {
    const target =
      kind === null
        ? null
        : kind === "div"
          ? document.createElement("div")
          : script({ key: kind === "empty-key" ? "" : null });
    expect(await mount(target)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.innerHTML).toBe("");
  });

  it.each([404, 401, 429, 500])(
    "a %i config → nothing rendered, nothing logged",
    async (status) => {
      const log = vi.spyOn(console, "log");
      const error = vi.spyOn(console, "error");
      const warn = vi.spyOn(console, "warn");
      serve({ error: { code: "not_found", message: "Unknown key" } }, status);
      expect(await mount(script())).toBeNull();
      expect(document.body.innerHTML).toBe("");
      expect(document.head.innerHTML).toBe("");
      expect([log, error, warn].every((spy) => spy.mock.calls.length === 0)).toBe(true);
    },
  );

  it("a network error → nothing rendered", async () => {
    const error = vi.spyOn(console, "error");
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await mount(script())).toBeNull();
    expect(document.body.innerHTML).toBe("");
    expect(error).not.toHaveBeenCalled();
  });

  it("a non-JSON 200 → nothing rendered", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 200 }));
    expect(await mount(script())).toBeNull();
    expect(document.body.innerHTML).toBe("");
  });

  it("mounts once even if the script is on the page twice", async () => {
    serve({ config: CONFIG });
    await mount(script());
    serve({ config: CONFIG });
    expect(await mount(script())).toBeNull();
    expect(document.querySelectorAll("[data-askwell]")).toHaveLength(1);
  });

  it("mounts once when two copies load at the same time", async () => {
    fetchMock.mockImplementation(async () => Response.json({ config: CONFIG }));
    const hosts = await Promise.all([mount(script()), mount(script())]);
    expect(hosts.filter(Boolean)).toHaveLength(1);
    expect(document.querySelectorAll("[data-askwell]")).toHaveLength(1);
  });

  it("mounts once when two copies wait for DOMContentLoaded", async () => {
    fetchMock.mockImplementation(async () => Response.json({ config: CONFIG }));
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    const both = Promise.all([mount(script()), mount(script())]);
    // Let both fetches finish, so both are parked on DOMContentLoaded.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector("[data-askwell]")).toBeNull();

    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect((await both).filter(Boolean)).toHaveLength(1);
    expect(document.querySelectorAll("[data-askwell]")).toHaveLength(1);
  });
});

describe("parseConfig", () => {
  it("keeps the fields the loader uses", () => {
    expect(parseConfig({ config: { ...CONFIG, showBadge: false } })).toEqual(CONFIG);
  });

  it.each([
    ["missing config", {}],
    ["null body", null],
    ["a CSS-breaking color", { config: { ...CONFIG, buttonColor: "red;}*{display:none" } }],
    ["a short hex", { config: { ...CONFIG, buttonColor: "#fff" } }],
    ["an unknown position", { config: { ...CONFIG, position: "center" } }],
    ["an unknown animation", { config: { ...CONFIG, animation: "spin" } }],
    ["a blank label", { config: { ...CONFIG, label: "  " } }],
    ["a non-string label", { config: { ...CONFIG, label: 7 } }],
  ])("rejects %s", (_name, body) => {
    expect(parseConfig(body)).toBeNull();
  });
});

describe("render: isolation and styles", () => {
  it("puts the button in a shadow root, and nothing else on the page", async () => {
    const headBefore = document.head.innerHTML;
    const { host, root, button } = await mounted();
    expect(document.body.children).toHaveLength(1);
    expect(document.body.firstElementChild).toBe(host);
    expect(document.querySelector("button")).toBeNull();
    expect(document.querySelector("style")).toBeNull();
    expect(document.head.innerHTML).toBe(headBefore);
    expect(root.querySelector("style")).not.toBeNull();
    expect(button.textContent).toBe("Chat with us");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("applies color, position and animation from the config", async () => {
    const { root, wrap } = await mounted({
      buttonColor: "#ffcc00",
      position: "top-left",
      animation: "scale",
    });
    expect(root.querySelector("style")!.textContent).toContain("background:#ffcc00;color:#000");
    expect(wrap.classList.contains("top")).toBe(true);
    expect(wrap.classList.contains("left")).toBe(true);
    expect(wrap.classList.contains("scale")).toBe(true);
  });

  it("renders the label as text, never HTML", async () => {
    const { root, button } = await mounted({ label: "<img src=x onerror=alert(1)>" });
    expect(root.querySelector("img")).toBeNull();
    expect(button.textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("picks readable text on light and dark buttons", () => {
    expect(textColorFor("#000000")).toBe("#fff");
    expect(textColorFor("#ffffff")).toBe("#000");
    expect(textColorFor("#2563eb")).toBe("#fff");
  });
});

describe("panel and messages", () => {
  it("opens an iframe to /embed?key= on click, and toggles", async () => {
    const { root, button, wrap } = await mounted();
    expect(root.querySelector("iframe")).toBeNull();

    const iframe = await openPanel(button, root);
    expect(iframe.src).toBe(`${APP_ORIGIN}/embed?key=${KEY}`);
    expect(iframe.title).toBe("Chat with us");
    expect(wrap.classList.contains("open")).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("true");

    button.click();
    expect(wrap.classList.contains("open")).toBe(false);
    button.click();
    expect(wrap.classList.contains("open")).toBe(true);
    expect(root.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("sends askwell:init to the app origin when the iframe loads, never to *", async () => {
    const { root, button } = await mounted();
    const iframe = await openPanel(button, root);
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    iframe.dispatchEvent(new Event("load"));
    expect(postMessage).toHaveBeenCalledWith({ type: "askwell:init" }, APP_ORIGIN);
    expect(postMessage.mock.calls.every((call) => (call[1] as unknown) === APP_ORIGIN)).toBe(true);
  });

  it("askwell:close from the panel closes it", async () => {
    const { root, button, wrap } = await mounted();
    const iframe = await openPanel(button, root);
    post({ type: "askwell:close" }, { source: iframe.contentWindow });
    expect(wrap.classList.contains("open")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("askwell:resize sets the panel height", async () => {
    const { root, button } = await mounted();
    const iframe = await openPanel(button, root);
    post({ type: "askwell:resize", height: 420.4 }, { source: iframe.contentWindow });
    expect(iframe.style.height).toBe("420px");
  });

  it("askwell:unread shows a badge while closed, hides it while open", async () => {
    const { root, button, badge } = await mounted();
    const iframe = await openPanel(button, root);
    post({ type: "askwell:close" }, { source: iframe.contentWindow });
    post({ type: "askwell:unread", count: 3 }, { source: iframe.contentWindow });
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe("3");

    post({ type: "askwell:unread", count: 12 }, { source: iframe.contentWindow });
    expect(badge.textContent).toBe("9+");

    button.click();
    expect(badge.hidden).toBe(true);

    post({ type: "askwell:close" }, { source: iframe.contentWindow });
    expect(badge.hidden).toBe(true);
  });

  it("ignores askwell:unread while open, so no stale badge after closing", async () => {
    const { root, button, badge } = await mounted();
    const iframe = await openPanel(button, root);
    post({ type: "askwell:unread", count: 4 }, { source: iframe.contentWindow });
    post({ type: "askwell:close" }, { source: iframe.contentWindow });
    expect(badge.hidden).toBe(true);

    button.click();
    button.click();
    expect(badge.hidden).toBe(true);
  });

  it("ignores messages from another origin", async () => {
    const { root, button, wrap, badge } = await mounted();
    const iframe = await openPanel(button, root);
    post({ type: "askwell:close" }, { origin: "https://evil.test", source: iframe.contentWindow });
    post(
      { type: "askwell:resize", height: 10 },
      { origin: "https://evil.test", source: iframe.contentWindow },
    );
    expect(wrap.classList.contains("open")).toBe(true);
    expect(iframe.style.height).toBe("");

    post({ type: "askwell:close" }, { source: iframe.contentWindow });
    post(
      { type: "askwell:unread", count: 5 },
      { origin: "https://evil.test", source: iframe.contentWindow },
    );
    expect(badge.hidden).toBe(true);
  });

  it("ignores app-origin messages that don't come from our iframe", async () => {
    const { root, button, wrap } = await mounted();
    await openPanel(button, root);
    post({ type: "askwell:close" }, { source: window });
    post({ type: "askwell:close" }, { source: null });
    expect(wrap.classList.contains("open")).toBe(true);
  });

  it("ignores a null-source message while the panel has no window", async () => {
    const { root, button, wrap } = await mounted();
    button.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(root.querySelector("iframe")!.contentWindow).toBeNull();
    post({ type: "askwell:close" }, { source: null });
    expect(wrap.classList.contains("open")).toBe(true);
  });

  it("ignores malformed messages from our iframe", async () => {
    const { root, button, wrap } = await mounted();
    const iframe = await openPanel(button, root);
    post({ type: "askwell:resize", height: "9999px" }, { source: iframe.contentWindow });
    post("askwell:close", { source: iframe.contentWindow });
    expect(iframe.style.height).toBe("");
    expect(wrap.classList.contains("open")).toBe(true);
  });

  it("ignores messages before the panel was ever opened", async () => {
    const { badge } = await mounted();
    post({ type: "askwell:unread", count: 2 }, { source: window });
    expect(badge.hidden).toBe(true);
  });
});

describe("init handshake", () => {
  /** Opens the panel, then fakes timers and fires the iframe's load. */
  async function loaded() {
    const parts = await mounted();
    const iframe = await openPanel(parts.button, parts.root);
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    vi.useFakeTimers();
    iframe.dispatchEvent(new Event("load"));
    const inits = () => postMessage.mock.calls.length;
    return { ...parts, iframe, postMessage, inits };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a lost init until askwell:ready, then stops", async () => {
    const { iframe, postMessage, inits } = await loaded();
    // The panel wasn't listening yet: this first init is lost.
    expect(inits()).toBe(1);
    vi.advanceTimersByTime(250);
    expect(inits()).toBe(2);
    vi.advanceTimersByTime(250);
    expect(inits()).toBe(3);
    expect(postMessage.mock.calls.every((call) => (call[1] as unknown) === APP_ORIGIN)).toBe(true);

    post({ type: "askwell:ready" }, { source: iframe.contentWindow });
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5_000);
    expect(inits()).toBe(3);
  });

  it("ignores askwell:ready from the wrong origin or source", async () => {
    const { iframe, inits } = await loaded();
    post({ type: "askwell:ready" }, { origin: "https://evil.test", source: iframe.contentWindow });
    post({ type: "askwell:ready" }, { source: window });
    post({ type: "askwell:ready" }, { source: null });
    vi.advanceTimersByTime(500);
    expect(inits()).toBe(3);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("gives up after 10 s with no timer left running", async () => {
    const { inits } = await loaded();
    vi.advanceTimersByTime(9_999);
    expect(inits()).toBe(40);
    vi.advanceTimersByTime(1);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(inits()).toBe(40);
  });

  it("stops retrying once the iframe is removed from the page", async () => {
    const { host, inits } = await loaded();
    host.remove();
    vi.advanceTimersByTime(250);
    expect(inits()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a reload restarts init without stacking timers", async () => {
    const { iframe, inits } = await loaded();
    post({ type: "askwell:ready" }, { source: iframe.contentWindow });
    iframe.dispatchEvent(new Event("load"));
    iframe.dispatchEvent(new Event("load"));
    expect(vi.getTimerCount()).toBe(1);
    expect(inits()).toBe(3);
    vi.advanceTimersByTime(250);
    expect(inits()).toBe(4);
  });
});
