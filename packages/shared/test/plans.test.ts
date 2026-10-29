import { describe, expect, it } from "vitest";
import { PLAN_LIMITS, PLAN_PRICES, PlanSchema } from "../src";

describe("PLAN_LIMITS (project.md §5)", () => {
  it("Free: 1 project, 100 messages/month, 3 sources, no customization", () => {
    expect(PLAN_LIMITS.free.projects).toBe(1);
    expect(PLAN_LIMITS.free.messagesPerMonthPerProject).toBe(100);
    expect(PLAN_LIMITS.free.knowledgeSourcesPerProject).toBe(3);
    expect(PLAN_LIMITS.free.customization).toEqual({
      buttonColor: false,
      position: false,
      label: false,
      animation: false,
      headerText: false,
      hideBadge: false,
    });
  });

  it("Pro: 5 projects, 2,000 messages/month, 25 sources, full customization", () => {
    expect(PLAN_LIMITS.pro.projects).toBe(5);
    expect(PLAN_LIMITS.pro.messagesPerMonthPerProject).toBe(2000);
    expect(PLAN_LIMITS.pro.knowledgeSourcesPerProject).toBe(25);
    expect(PLAN_LIMITS.pro.customization).toEqual({
      buttonColor: true,
      position: true,
      label: true,
      animation: true,
      headerText: true,
      hideBadge: true,
    });
  });

  it("covers exactly the two plans", () => {
    expect(Object.keys(PLAN_LIMITS).sort()).toEqual([...PlanSchema.options].sort());
  });
});

describe("PLAN_PRICES", () => {
  it("Pro is $19/month", () => {
    expect(PLAN_PRICES.pro.monthlyUsd).toBe(19);
  });
});
