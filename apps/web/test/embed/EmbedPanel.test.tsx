// @vitest-environment jsdom
import { APP_NAME, MESSAGE_MAX_LENGTH } from "@askwell/shared";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmbedPanel } from "../../components/embed/EmbedPanel";
import { MOCK_REPLY, MOCK_REPLY_DELAY_MS } from "../../components/embed/chat-client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HOST = "https://customer.test";
const KEY = "pk_test_abc12345";

let container: HTMLDivElement;
let root: Root;
// Stands in for the host page: jsdom only accepts a Window or MessagePort as a message `source`.
let parent: MessagePort;
let parentPost: ReturnType<typeof vi.fn>;

async function render(config = { headerText: "How can we help?", showBadge: true }) {
  await act(async () => root.render(<EmbedPanel publicKey={KEY} config={config} />));
}

const $ = <T extends Element = HTMLElement>(selector: string) =>
  container.querySelector<T>(selector)!;

function messages() {
  return [...container.querySelectorAll("[data-role]")].map((el) => ({
    role: el.getAttribute("data-role"),
    text: el.textContent,
  }));
}

async function type(value: string) {
  const input = $<HTMLInputElement>('input[aria-label="Message"]');
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setValue.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function send(value: string) {
  await type(value);
  await act(async () => $<HTMLButtonElement>('button[aria-label="Send"]').click());
}

async function init(source: MessageEventSource = parent, origin = HOST) {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", { data: { type: "askwell:init" }, origin, source }),
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  parent = new MessageChannel().port1;
  parentPost = vi.fn();
  parent.postMessage = parentPost as MessagePort["postMessage"];
  Object.defineProperty(window, "parent", { configurable: true, get: () => parent });
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  Object.defineProperty(window, "parent", { configurable: true, get: () => window });
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("EmbedPanel", () => {
  it("shows the header text from the config", async () => {
    await render({ headerText: "Ask Acme anything", showBadge: true });
    expect($("h1").textContent).toBe("Ask Acme anything");
  });

  it("renders a message with HTML in it as literal text", async () => {
    await render();
    await send("<img src=x onerror=alert(1)>");
    expect(messages()[0]).toEqual({ role: "visitor", text: "<img src=x onerror=alert(1)>" });
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("shows the typing state, then the mock reply", async () => {
    await render();
    await send("Do you ship to Canada?");
    expect($('[role="status"][aria-label="Typing"]')).not.toBeNull();
    expect(messages()).toEqual([{ role: "visitor", text: "Do you ship to Canada?" }]);
    expect($<HTMLButtonElement>('button[aria-label="Send"]').disabled).toBe(true);

    await act(async () => vi.advanceTimersByTimeAsync(MOCK_REPLY_DELAY_MS));
    expect(container.querySelector('[aria-label="Typing"]')).toBeNull();
    expect(messages()).toEqual([
      { role: "visitor", text: "Do you ship to Canada?" },
      { role: "bot", text: MOCK_REPLY },
    ]);
  });

  it("stores a visitor ID and reuses it", async () => {
    await render();
    await send("one");
    await act(async () => vi.advanceTimersByTimeAsync(MOCK_REPLY_DELAY_MS));
    const id = window.localStorage.getItem("askwell:visitor-id");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await send("two");
    await act(async () => vi.advanceTimersByTimeAsync(MOCK_REPLY_DELAY_MS));
    expect(window.localStorage.getItem("askwell:visitor-id")).toBe(id);
  });

  it.each([
    ["/simulate rate_limited", /a little fast/],
    ["/simulate quota_exceeded", /can't take new messages/],
  ])("%s shows a friendly message", async (message, text) => {
    await render();
    await send(message);
    await act(async () => vi.advanceTimersByTimeAsync(MOCK_REPLY_DELAY_MS));
    expect($('[role="alert"]').textContent).toMatch(text);
    expect(messages().filter((m) => m.role === "bot")).toEqual([]);
    expect(container.querySelector('[aria-label="Typing"]')).toBeNull();
  });

  it("caps the input at MESSAGE_MAX_LENGTH", async () => {
    await render();
    const input = $<HTMLInputElement>('input[aria-label="Message"]');
    expect(input.maxLength).toBe(MESSAGE_MAX_LENGTH);
    await type("x".repeat(MESSAGE_MAX_LENGTH + 50));
    expect(input.value).toHaveLength(MESSAGE_MAX_LENGTH);
    expect(container.textContent).toContain(`${MESSAGE_MAX_LENGTH}/${MESSAGE_MAX_LENGTH}`);
  });

  it("can't send a blank message", async () => {
    await render();
    await type("   ");
    expect($<HTMLButtonElement>('button[aria-label="Send"]').disabled).toBe(true);
  });

  it("shows the Powered by badge only when showBadge", async () => {
    await render({ headerText: "Hi", showBadge: true });
    expect(container.textContent).toContain(`Powered by ${APP_NAME}`);
    await render({ headerText: "Hi", showBadge: false });
    expect(container.textContent).not.toContain("Powered by");
  });
});

describe("EmbedPanel ↔ loader", () => {
  it("close sends askwell:close to the stored host origin only", async () => {
    await render();
    await init();
    await act(async () => $<HTMLButtonElement>('button[aria-label="Close chat"]').click());
    expect(parentPost).toHaveBeenCalledTimes(1);
    expect(parentPost).toHaveBeenCalledWith({ type: "askwell:close" }, HOST);
  });

  it("Escape also sends askwell:close", async () => {
    await render();
    await init();
    const input = $<HTMLInputElement>('input[aria-label="Message"]');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(parentPost).toHaveBeenCalledWith({ type: "askwell:close" }, HOST);
  });

  it("ignores askwell:init from a source that isn't window.parent", async () => {
    await render();
    await init(new MessageChannel().port1, "https://evil.test");
    await act(async () => $<HTMLButtonElement>('button[aria-label="Close chat"]').click());
    expect(parentPost).not.toHaveBeenCalled();
  });

  it("sends nothing before askwell:init", async () => {
    await render();
    await act(async () => $<HTMLButtonElement>('button[aria-label="Close chat"]').click());
    expect(parentPost).not.toHaveBeenCalled();
  });

  it("counts a reply as unread when the panel isn't focused, and clears it on focus", async () => {
    await render();
    await init();
    vi.mocked(document.hasFocus).mockReturnValue(false);
    await send("hello");
    await act(async () => vi.advanceTimersByTimeAsync(MOCK_REPLY_DELAY_MS));
    expect(parentPost).toHaveBeenLastCalledWith({ type: "askwell:unread", count: 1 }, HOST);

    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(parentPost).toHaveBeenLastCalledWith({ type: "askwell:unread", count: 0 }, HOST);
  });

  it("doesn't count a reply the visitor is looking at", async () => {
    await render();
    await init();
    await send("hello");
    await act(async () => vi.advanceTimersByTimeAsync(MOCK_REPLY_DELAY_MS));
    expect(parentPost).not.toHaveBeenCalled();
  });
});
