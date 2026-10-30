import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  isAuthenticated: true,
  userId: "user_from_clerk" as string | null,
}));

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
const ensureAccount = vi.hoisted(() => vi.fn<(clerkUserId: string) => Promise<void>>());

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ isAuthenticated: state.isAuthenticated, userId: state.userId }),
}));
vi.mock("next/navigation", () => ({ redirect, usePathname: () => "/dashboard" }));
vi.mock("@clerk/nextjs", () => ({ UserButton: () => null }));
vi.mock("../../lib/accounts", () => ({ ensureAccount }));

import DashboardLayout from "../../app/(site)/dashboard/layout";

describe("DashboardLayout account row", () => {
  beforeEach(() => {
    state.isAuthenticated = true;
    state.userId = "user_from_clerk";
    redirect.mockClear();
    ensureAccount.mockReset();
    ensureAccount.mockResolvedValue(undefined);
  });

  it("ensures the account for Clerk's server userId, then renders the page", async () => {
    const html = renderToStaticMarkup(await DashboardLayout({ children: <p>Inner page</p> }));
    expect(ensureAccount).toHaveBeenCalledTimes(1);
    expect(ensureAccount).toHaveBeenCalledWith("user_from_clerk");
    expect(html).toContain("Inner page");
    expect(html).not.toContain('role="alert"');
  });

  it("redirects a signed-out request without touching accounts", async () => {
    state.isAuthenticated = false;
    state.userId = null;
    await expect(DashboardLayout({ children: "hidden" })).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(ensureAccount).not.toHaveBeenCalled();
  });

  it("shows the ErrorState instead of the page when the account can't be created", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    ensureAccount.mockRejectedValue(new Error("ensureAccount: boom"));

    const html = renderToStaticMarkup(await DashboardLayout({ children: <p>Inner page</p> }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("We could not set up your account");
    expect(html).not.toContain("Inner page");
    // The sidebar stays, so the user can still sign out.
    expect(html).toContain("Projects");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
