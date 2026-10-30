import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BillingPage from "../../app/dashboard/billing/page";
import DashboardError from "../../app/dashboard/error";
import Loading from "../../app/dashboard/loading";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

describe("Billing page", () => {
  it("shows a placeholder empty state", () => {
    const html = renderToStaticMarkup(<BillingPage />);
    expect(html).toContain("Billing is not set up yet");
    expect(html).toContain("Phase 5");
  });
});

describe("loading.tsx", () => {
  it("is a status region", () => {
    const html = renderToStaticMarkup(<Loading />);
    expect(html).toContain('role="status"');
  });
});

describe("error.tsx", () => {
  it("is an alert with a retry button", () => {
    const html = renderToStaticMarkup(
      <DashboardError error={new Error("boom")} retry={() => {}} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Try again");
    expect(html).not.toContain("boom");
  });
});
