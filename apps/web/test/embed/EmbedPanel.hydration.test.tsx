// @vitest-environment jsdom
import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { EmbedPanel } from "../../components/embed/EmbedPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const props = { publicKey: "pk_test_abc12345", config: { headerText: "Hi", showBadge: true } };

let root: Root | undefined;
let container: HTMLDivElement;

/** Server HTML in the DOM, the visitor types, then React hydrates (like a slow page load). */
async function typeBeforeHydration(text: string) {
  container = document.createElement("div");
  container.innerHTML = renderToString(<EmbedPanel {...props} />);
  document.body.append(container);
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Message"]')!;
  input.value = text;
  await act(async () => {
    root = hydrateRoot(container, <EmbedPanel {...props} />);
  });
  return {
    input: container.querySelector<HTMLInputElement>('input[aria-label="Message"]')!,
    send: container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!,
  };
}

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  container.remove();
});

describe("EmbedPanel before hydration", () => {
  it("counts text typed before React hydrated: Send is enabled", async () => {
    const { input, send } = await typeBeforeHydration("Typed while the page loaded");
    expect(input.value).toBe("Typed while the page loaded");
    expect(send.disabled).toBe(false);
  });

  it("keeps Send off when nothing was typed", async () => {
    const { send } = await typeBeforeHydration("");
    expect(send.disabled).toBe(true);
  });

  it("caps pre-hydration text at MESSAGE_MAX_LENGTH", async () => {
    const { input, send } = await typeBeforeHydration("x".repeat(1200));
    expect(input.value).toHaveLength(1000);
    expect(send.disabled).toBe(false);
  });
});
