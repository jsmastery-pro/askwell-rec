import { AsyncLocalStorage } from "node:async_hooks";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: () => () => undefined }));

// Next's matcher helper expects the AsyncLocalStorage global the Next runtime normally sets.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;

type DoesMatch = (args: { config: { matcher?: string[] }; url: string }) => boolean;
let doesMatch: DoesMatch;
let matcher: string[];

beforeAll(async () => {
  ({ unstable_doesMiddlewareMatch: doesMatch } = await import("next/experimental/testing/server"));
  ({ matcher } = (await import("../../proxy")).config);
});

const runs = (url: string) => doesMatch({ config: { matcher }, url });

describe("proxy matcher", () => {
  it.each(["/embed", "/embed?key=pk_test_abc12345", "/embed/", "/embed/anything"])(
    "skips %s, so Clerk never runs or redirects in the widget panel",
    (url) => {
      expect(runs(url)).toBe(false);
    },
  );

  it.each([
    "/",
    "/dashboard",
    "/dashboard/billing",
    "/sign-in",
    "/embedded",
    "/api/widget/config",
    "/api/projects",
  ])("still runs on %s", (url) => {
    expect(runs(url)).toBe(true);
  });

  it.each(["/widget.js", "/_next/static/chunk.js", "/favicon.ico"])("skips static %s", (url) => {
    expect(runs(url)).toBe(false);
  });
});
