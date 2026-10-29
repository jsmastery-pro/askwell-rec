import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (
  auth: () => Promise<{ isAuthenticated: boolean; redirectToSignIn: (o: object) => Response }>,
  req: { nextUrl: { pathname: string }; url: string },
) => Promise<Response | void>;

const captured: { handler?: Handler; options?: unknown } = {};

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: Handler, options: unknown) => {
    captured.handler = handler;
    captured.options = options;
    return () => undefined;
  },
}));

const redirectToSignIn = vi.fn(
  () => new Response(null, { status: 307, headers: { location: "/sign-in" } }),
);

function run(pathname: string, isAuthenticated: boolean) {
  const handler = captured.handler;
  if (!handler) throw new Error("proxy did not register a handler");
  return handler(async () => ({ isAuthenticated, redirectToSignIn }), {
    nextUrl: { pathname },
    url: `https://askwell.test${pathname}`,
  });
}

describe("proxy", () => {
  beforeEach(async () => {
    redirectToSignIn.mockClear();
    await import("../../proxy");
  });

  it("points Clerk at our own sign-in and sign-up pages", () => {
    expect(captured.options).toEqual({ signInUrl: "/sign-in", signUpUrl: "/sign-up" });
  });

  it("lets public paths through signed out", async () => {
    expect(await run("/", false)).toBeUndefined();
    expect(await run("/api/widget/chat", false)).toBeUndefined();
    expect(redirectToSignIn).not.toHaveBeenCalled();
  });

  it("redirects a signed-out page request to sign-in", async () => {
    const res = await run("/dashboard", false);
    expect(redirectToSignIn).toHaveBeenCalledWith({
      returnBackUrl: "https://askwell.test/dashboard",
    });
    expect(res?.status).toBe(307);
  });

  it("returns 401 JSON, not a redirect, to a signed-out API request", async () => {
    const res = await run("/api/projects", false);
    expect(redirectToSignIn).not.toHaveBeenCalled();
    expect(res?.status).toBe(401);
    expect(await res?.json()).toEqual({
      error: { code: "unauthorized", message: expect.any(String) },
    });
  });

  it("lets a signed-in user through", async () => {
    expect(await run("/dashboard", true)).toBeUndefined();
    expect(await run("/api/projects", true)).toBeUndefined();
  });
});
