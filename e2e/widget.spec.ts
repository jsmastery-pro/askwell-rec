import { expect, test, type Page } from "@playwright/test";

// Phase 2 done-when (plan.md): a plain HTML page on another origin shows the button, the panel
// opens and shows a reply. Run with `pnpm e2e` (see playwright.config.ts).
const APP_URL = process.env.E2E_APP_URL?.replace(/\/+$/, "") ?? "";
const APP_ORIGIN = APP_URL ? new URL(APP_URL).origin : "";
// Well-formed but unknown: the config route answers 404.
const UNKNOWN_KEY = "pk_e2e_placeholder_unknown_key";
const FAKE_CONVERSATION_ID = "0b8f3c55-2f1d-4f3e-8f53-5b2a7b0b4a11";
const FAKE_REPLY = "A fake reply from the e2e chat route.";

test.beforeAll(() => {
  if (!APP_URL || !process.env.E2E_PUBLIC_KEY) {
    throw new Error("Set E2E_APP_URL and E2E_PUBLIC_KEY (a dev project's public key).");
  }
});

// Protected Vercel previews: with VERCEL_AUTOMATION_BYPASS_SECRET set, add the bypass header to
// every request to the app's origin (widget.js, the config fetch, the /embed iframe and its
// assets), and to nothing else. The secret stays in this process, never in the host page. A
// header on each request needs no bypass cookie, which a cross-origin iframe may not send.
test.beforeEach(async ({ context }) => {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret) return;
  await context.route(
    (url) => url.origin === APP_ORIGIN,
    (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-vercel-protection-bypass": secret },
      }),
  );
});

/**
 * Answers `POST /api/widget/chat` with a fake reply after a short delay (so the typing state
 * shows), so CI never calls OpenAI. Returns the JSON bodies the panel posted.
 */
async function fakeChatRoute(page: Page) {
  const posted: Array<Record<string, unknown>> = [];
  await page.route(`${APP_ORIGIN}/api/widget/chat`, async (route) => {
    posted.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ json: { conversationId: FAKE_CONVERSATION_ID, reply: FAKE_REPLY } });
  });
  return posted;
}

const host = (page: Page) => page.locator("[data-askwell]");
const widgetButton = (page: Page) => host(page).locator("button.b");
const panelFrame = (page: Page) => host(page).locator("iframe");
const panel = (page: Page) => page.frameLocator("[data-askwell] iframe");

async function openHostPage(page: Page, query = "") {
  const config = page.waitForResponse((r) => r.url().startsWith(`${APP_ORIGIN}/api/widget/config`));
  await page.goto(`/${query}`);
  return config;
}

test("the host page runs on a different origin than the app", async ({ page }) => {
  await openHostPage(page);
  const hostOrigin = await page.evaluate(() => location.origin);
  expect(hostOrigin).not.toBe(APP_ORIGIN);
});

test("1. the button appears inside a shadow root", async ({ page }) => {
  const config = await openHostPage(page);
  expect((await config).status()).toBe(200);
  await expect(widgetButton(page)).toBeVisible();

  const placement = await page.evaluate(() => ({
    inShadow: Boolean(
      document.querySelector("[data-askwell]")?.shadowRoot?.querySelector("button"),
    ),
    inLightDom: document.querySelectorAll("button").length,
  }));
  expect(placement).toEqual({ inShadow: true, inLightDom: 0 });
});

test("2–4. open the panel, get a reply after the typing state, close it", async ({ page }) => {
  // The panel uses nothing from Clerk, so customer pages must never load it (§9).
  const clerkRequests: string[] = [];
  page.on("request", (request) => {
    if (/clerk/i.test(new URL(request.url()).hostname)) clerkRequests.push(request.url());
  });
  const posted = await fakeChatRoute(page);
  await openHostPage(page);
  await widgetButton(page).click();

  // 2. The iframe to /embed?key= loads.
  const frame = panelFrame(page);
  await expect(frame).toBeVisible();
  const src = new URL((await frame.getAttribute("src")) ?? "");
  expect(src.origin).toBe(APP_ORIGIN);
  expect(src.pathname).toBe("/embed");
  expect(src.searchParams.get("key")).toBe(process.env.E2E_PUBLIC_KEY);
  await expect(panel(page).getByRole("heading", { level: 1 })).toBeVisible();

  // 3. Type a message → typing state → reply. The chat route is faked (no OpenAI in CI).
  const send = panel(page).getByRole("button", { name: "Send" });
  const input = panel(page).getByRole("textbox", { name: "Message" });
  await input.fill("Hello from the e2e host page");
  await expect(send).toBeEnabled();
  await send.click();
  await expect(panel(page).locator('[data-role="visitor"]')).toHaveText(
    "Hello from the e2e host page",
  );
  await expect(panel(page).getByRole("status", { name: "Typing" })).toBeVisible();
  const reply = panel(page).locator('[data-role="bot"]');
  await expect(reply).toHaveText([FAKE_REPLY], { timeout: 15_000 });
  await expect(panel(page).getByRole("status", { name: "Typing" })).toHaveCount(0);

  // A second message reuses the conversation the route returned.
  await input.fill("And a follow-up");
  await send.click();
  await expect(reply).toHaveText([FAKE_REPLY, FAKE_REPLY]);
  expect(posted).toEqual([
    expect.objectContaining({
      key: process.env.E2E_PUBLIC_KEY,
      message: "Hello from the e2e host page",
    }),
    expect.objectContaining({ message: "And a follow-up", conversationId: FAKE_CONVERSATION_ID }),
  ]);
  expect(posted[0]).not.toHaveProperty("conversationId");

  // 4. Close from the panel header → askwell:close over postMessage → the iframe hides.
  await panel(page).getByRole("button", { name: "Close chat" }).click();
  await expect(frame).toBeHidden();
  await expect(widgetButton(page)).toHaveAttribute("aria-expanded", "false");
  expect(clerkRequests).toEqual([]);
});

test("5. a bad key renders no button", async ({ page }) => {
  const config = await openHostPage(page, `?key=${UNKNOWN_KEY}`);
  expect((await config).status()).toBe(404);
  // Give the loader time to (not) render after the response.
  await page.waitForTimeout(500);
  await expect(host(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.body.querySelectorAll("button, iframe").length)).toBe(
    0,
  );
});
