import { describe, expect, it } from "vitest";
import { DASHBOARD_NAV, isNavActive } from "../../components/dashboard/nav";

describe("DASHBOARD_NAV", () => {
  it("has Projects and Billing", () => {
    expect(DASHBOARD_NAV).toEqual([
      { label: "Projects", href: "/dashboard" },
      { label: "Billing", href: "/dashboard/billing" },
    ]);
  });
});

describe("isNavActive", () => {
  it("highlights Projects only on /dashboard", () => {
    expect(isNavActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavActive("/dashboard/", "/dashboard")).toBe(true);
    expect(isNavActive("/dashboard/billing", "/dashboard")).toBe(false);
  });

  it("highlights Billing on its page and below it", () => {
    expect(isNavActive("/dashboard/billing", "/dashboard/billing")).toBe(true);
    expect(isNavActive("/dashboard/billing/invoices", "/dashboard/billing")).toBe(true);
    expect(isNavActive("/dashboard/billingx", "/dashboard/billing")).toBe(false);
    expect(isNavActive("/dashboard", "/dashboard/billing")).toBe(false);
  });
});
