import { PLAN_LIMITS, PLAN_PRICES } from "@askwell/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Pricing } from "../../components/landing";
import { priceOf } from "../../components/landing/Pricing";

const fmt = (n: number) => n.toLocaleString("en-US");

function planHtml(html: string, plan: "free" | "pro") {
  const start = html.indexOf(`data-plan="${plan}"`);
  const next = html.indexOf("data-plan=", start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

describe("Pricing", () => {
  const html = renderToStaticMarkup(<Pricing />);

  it.each(["free", "pro"] as const)("shows the %s limits from PLAN_LIMITS", (plan) => {
    const card = planHtml(html, plan);
    const limits = PLAN_LIMITS[plan];
    expect(card).toContain(`${fmt(limits.projects)} project`);
    expect(card).toContain(`${fmt(limits.messagesPerMonthPerProject)} messages / month`);
    expect(card).toContain(`${fmt(limits.knowledgeSourcesPerProject)} knowledge sources`);
  });

  it("matches the plan table: 100 / 2,000 messages, 1 / 5 projects, 3 / 25 sources", () => {
    expect(planHtml(html, "free")).toContain("100 messages");
    expect(planHtml(html, "pro")).toContain("2,000 messages");
    expect(planHtml(html, "free")).toContain("1 project<");
    expect(planHtml(html, "pro")).toContain("5 projects");
    expect(planHtml(html, "free")).toContain("3 knowledge sources");
    expect(planHtml(html, "pro")).toContain("25 knowledge sources");
  });

  it("prices Free at $0 and Pro from PLAN_PRICES ($19)", () => {
    expect(priceOf("free")).toBe(0);
    expect(priceOf("pro")).toBe(PLAN_PRICES.pro.monthlyUsd);
    expect(planHtml(html, "free")).toContain("$0");
    expect(planHtml(html, "pro")).toContain(`$${PLAN_PRICES.pro.monthlyUsd}`);
    expect(planHtml(html, "pro")).toContain("$19");
  });

  it("lists customization only for the plan that allows it", () => {
    expect(planHtml(html, "free")).toContain("Default widget look");
    expect(planHtml(html, "free")).not.toContain("Customize:");
    expect(planHtml(html, "pro")).toContain("Customize:");
  });

  it("links both plans to /sign-up", () => {
    expect(html.match(/href="\/sign-up"/g)).toHaveLength(2);
  });
});
