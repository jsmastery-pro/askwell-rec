import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BillingPage from "../../app/dashboard/billing/page";
import DashboardError from "../../app/dashboard/error";
import Loading from "../../app/dashboard/loading";
import ProjectsPage from "../../app/dashboard/page";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

describe("Projects page", () => {
  const html = renderToStaticMarkup(<ProjectsPage />);

  it("shows the empty state", () => {
    expect(html).toContain("<h1");
    expect(html).toContain("No projects yet");
  });

  it("has a disabled New project button and a Phase 2 note", () => {
    expect(html).toMatch(/<button [^>]*disabled[^>]*>New project<\/button>/);
    expect(html).toContain("Phase 2");
  });
});

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
