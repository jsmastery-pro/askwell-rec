import { describe, expect, it } from "vitest";
import {
  DEFAULT_WIDGET_CONFIG,
  UpdateWidgetConfigRequestSchema,
  WidgetConfigRequestSchema,
  WidgetConfigSchema,
} from "../src";

describe("DEFAULT_WIDGET_CONFIG", () => {
  it("is the Free look and a valid config", () => {
    expect(WidgetConfigSchema.parse(DEFAULT_WIDGET_CONFIG)).toEqual(DEFAULT_WIDGET_CONFIG);
    expect(DEFAULT_WIDGET_CONFIG.position).toBe("bottom-right");
    expect(DEFAULT_WIDGET_CONFIG.animation).toBe("fade");
    expect(DEFAULT_WIDGET_CONFIG.showBadge).toBe(true);
  });
});

describe("GET /api/widget/config", () => {
  it("needs a pk_ key", () => {
    expect(WidgetConfigRequestSchema.safeParse({ key: "pk_abcdef123456" }).success).toBe(true);
    expect(WidgetConfigRequestSchema.safeParse({ key: "sk_abcdef123456" }).success).toBe(false);
    expect(WidgetConfigRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("PATCH /api/projects/:id/config", () => {
  it("accepts a partial update", () => {
    expect(
      UpdateWidgetConfigRequestSchema.safeParse({ position: "top-left", buttonColor: "#ff0080" })
        .success,
    ).toBe(true);
  });

  it("rejects an unknown position", () => {
    expect(UpdateWidgetConfigRequestSchema.safeParse({ position: "middle" }).success).toBe(false);
  });

  it("rejects an unknown animation, a bad color, unknown fields and an empty patch", () => {
    expect(UpdateWidgetConfigRequestSchema.safeParse({ animation: "spin" }).success).toBe(false);
    expect(UpdateWidgetConfigRequestSchema.safeParse({ buttonColor: "red" }).success).toBe(false);
    expect(UpdateWidgetConfigRequestSchema.safeParse({ plan: "pro" }).success).toBe(false);
    expect(UpdateWidgetConfigRequestSchema.safeParse({}).success).toBe(false);
  });
});
