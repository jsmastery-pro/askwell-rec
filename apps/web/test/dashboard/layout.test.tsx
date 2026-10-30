import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ isAuthenticated: true }));

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({
    isAuthenticated: state.isAuthenticated,
    userId: state.isAuthenticated ? "user_123" : null,
  }),
}));
vi.mock("next/navigation", () => ({ redirect, usePathname: () => "/dashboard" }));
vi.mock("@clerk/nextjs", () => ({ UserButton: () => null }));
vi.mock("../../lib/accounts", () => ({ ensureAccount: async () => {} }));

import DashboardLayout from "../../app/dashboard/layout";

describe("DashboardLayout", () => {
  beforeEach(() => {
    state.isAuthenticated = true;
    redirect.mockClear();
  });

  it("redirects a signed-out request to /sign-in", async () => {
    state.isAuthenticated = false;
    await expect(DashboardLayout({ children: "hidden" })).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("renders the sidebar and children on the light surface when signed in", async () => {
    const html = renderToStaticMarkup(await DashboardLayout({ children: <p>Inner page</p> }));
    expect(redirect).not.toHaveBeenCalled();
    expect(html).toContain('data-theme="light"');
    expect(html).toContain("Projects");
    expect(html).toContain("Billing");
    expect(html).toContain("Inner page");
  });
});
