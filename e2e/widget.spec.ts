import { expect, test, type Page } from "@playwright/test";

// Phase 2 done-when (plan.md): a plain HTML page on another origin shows the button, the panel
// opens and shows a reply. Run with `pnpm e2e` (see playwright.config.ts).
const APP_URL = process.env.E2E_APP_URL?.replace(/\/+$/, "") ?? "";
const APP_ORIGIN = APP_URL ? new URL(APP_URL).origin : "";
// Well-formed but unknown: the config route answers 404.
const UNKNOWN_KEY = "pk_e2e_placeholder_unknown_key";

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

  // 3. Type a message → typing state → reply.
  // The input is server-rendered: text filled in before React hydrates doesn't reach its state,
  // and React then treats the same text as unchanged. Clear and refill until Send turns on.
  const textbox = panel(page).getByRole("textbox", { name: "Message" });
  const send = panel(page).getByRole("button", { name: "Send" });
  await expect(async () => {
    await textbox.fill("");
    await textbox.fill("Hello from the e2e host page");
    await expect(send).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await send.click();
  await expect(panel(page).locator('[data-role="visitor"]')).toHaveText(
    "Hello from the e2e host page",
  );
  await expect(panel(page).getByRole("status", { name: "Typing" })).toBeVisible();
  const reply = panel(page).locator('[data-role="bot"]');
  await expect(reply).toHaveCount(1, { timeout: 15_000 });
  await expect(reply).not.toHaveText("");
  await expect(panel(page).getByRole("status", { name: "Typing" })).toHaveCount(0);

  // 4. Close from the panel header → askwell:close over postMessage → the iframe hides.
  await panel(page).getByRole("button", { name: "Close chat" }).click();
  await expect(frame).toBeHidden();
  await expect(widgetButton(page)).toHaveAttribute("aria-expanded", "false");
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
