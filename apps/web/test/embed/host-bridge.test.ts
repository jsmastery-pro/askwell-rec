import { describe, expect, it, vi } from "vitest";
import { createHostBridge } from "../../components/embed/host-bridge";

const HOST = "https://customer.test";

/** A framed window: its own events, and a parent we can spy on. */
function framed() {
  const target = new EventTarget();
  const parent = { postMessage: vi.fn() };
  const win = Object.assign(target, { parent }) as unknown as Window;
  const deliver = (data: unknown, { origin = HOST, source = parent as unknown } = {}) => {
    win.dispatchEvent(Object.assign(new Event("message"), { data, origin, source }));
  };
  return { win, parent, deliver };
}

describe("createHostBridge", () => {
  it("stores the origin of askwell:init from window.parent and sends only there", () => {
    const { win, parent, deliver } = framed();
    const bridge = createHostBridge(win);
    deliver({ type: "askwell:init" });
    expect(bridge.hostOrigin()).toBe(HOST);

    bridge.send({ type: "askwell:close" });
    bridge.send({ type: "askwell:unread", count: 2 });
    bridge.send({ type: "askwell:resize", height: 400 });
    expect(parent.postMessage.mock.calls).toEqual([
      [{ type: "askwell:close" }, HOST],
      [{ type: "askwell:unread", count: 2 }, HOST],
      [{ type: "askwell:resize", height: 400 }, HOST],
    ]);
  });

  it("sends nothing before askwell:init", () => {
    const { win, parent } = framed();
    createHostBridge(win).send({ type: "askwell:close" });
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it("ignores askwell:init from a source that isn't window.parent", () => {
    const { win, parent, deliver } = framed();
    const bridge = createHostBridge(win);
    deliver({ type: "askwell:init" }, { source: { postMessage: vi.fn() } });
    deliver({ type: "askwell:init" }, { source: win });
    deliver({ type: "askwell:init" }, { source: null });
    expect(bridge.hostOrigin()).toBeNull();
    bridge.send({ type: "askwell:close" });
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it("keeps the first origin: a later init can't redirect messages", () => {
    const { win, parent, deliver } = framed();
    const bridge = createHostBridge(win);
    deliver({ type: "askwell:init" });
    deliver({ type: "askwell:init" }, { origin: "https://evil.test" });
    bridge.send({ type: "askwell:close" });
    expect(parent.postMessage).toHaveBeenCalledWith({ type: "askwell:close" }, HOST);
  });

  it("ignores an opaque origin, other message types and junk", () => {
    const { win, deliver } = framed();
    const bridge = createHostBridge(win);
    deliver({ type: "askwell:init" }, { origin: "null" });
    deliver({ type: "askwell:close" });
    deliver("askwell:init");
    deliver({ type: "askwell:resize", height: 10 });
    expect(bridge.hostOrigin()).toBeNull();
  });

  it("does nothing when not framed (parent is itself)", () => {
    const target = new EventTarget();
    const win = Object.assign(target, { postMessage: vi.fn() }) as unknown as Window;
    Object.assign(win, { parent: win });
    const bridge = createHostBridge(win);
    win.dispatchEvent(
      Object.assign(new Event("message"), {
        data: { type: "askwell:init" },
        origin: HOST,
        source: win,
      }),
    );
    expect(bridge.hostOrigin()).toBeNull();
  });

  it("stops listening after dispose", () => {
    const { win, deliver } = framed();
    const bridge = createHostBridge(win);
    bridge.dispose();
    deliver({ type: "askwell:init" });
    expect(bridge.hostOrigin()).toBeNull();
  });
});
