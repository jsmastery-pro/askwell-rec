import { APP_NAME } from "@askwell/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardSidebar } from "../../components/dashboard/DashboardSidebar";

let pathname = "/dashboard";

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@clerk/nextjs", () => ({ UserButton: () => <div data-testid="user-button" /> }));

function link(html: string, href: string): string {
  const match = html.match(new RegExp(`<a [^>]*href="${href}"[^>]*>`));
  if (!match) throw new Error(`no link to ${href}`);
  return match[0];
}

describe("DashboardSidebar", () => {
  beforeEach(() => {
    pathname = "/dashboard";
  });

  it("shows the app mark, both nav links and the user button", () => {
    const html = renderToStaticMarkup(<DashboardSidebar />);
    expect(html).toContain(APP_NAME);
    expect(html).toContain('aria-label="Dashboard"');
    expect(html).toMatch(/href="\/dashboard"[^>]*>Projects</);
    expect(html).toMatch(/href="\/dashboard\/billing"[^>]*>Billing</);
    expect(html).toContain('data-testid="user-button"');
  });

  it("marks Projects as the current page on /dashboard", () => {
    const html = renderToStaticMarkup(<DashboardSidebar />);
    expect(link(html, "/dashboard")).toContain('aria-current="page"');
    expect(link(html, "/dashboard/billing")).not.toContain("aria-current");
  });

  it("marks Billing as the current page on /dashboard/billing", () => {
    pathname = "/dashboard/billing";
    const html = renderToStaticMarkup(<DashboardSidebar />);
    expect(link(html, "/dashboard/billing")).toContain('aria-current="page"');
    expect(link(html, "/dashboard")).not.toContain("aria-current");
  });

  it("stacks as a top bar under 768 px and a sidebar from md up", () => {
    const html = renderToStaticMarkup(<DashboardSidebar />);
    expect(html).toContain("md:w-64");
    expect(html).toContain("grid");
  });
});
