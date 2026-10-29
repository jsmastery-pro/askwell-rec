import { describe, expect, it } from "vitest";
import { MESSAGE_MAX_LENGTH, WidgetChatRequestSchema } from "../src";

const base = {
  key: "pk_abcdef123456",
  visitorId: "3f0b8f4e-6a1c-4d2b-9a57-0e1f2a3b4c5d",
};

describe("POST /api/widget/chat", () => {
  it("accepts a message at the max length", () => {
    expect(
      WidgetChatRequestSchema.safeParse({ ...base, message: "a".repeat(MESSAGE_MAX_LENGTH) })
        .success,
    ).toBe(true);
  });

  it("rejects a message longer than MESSAGE_MAX_LENGTH", () => {
    expect(
      WidgetChatRequestSchema.safeParse({ ...base, message: "a".repeat(MESSAGE_MAX_LENGTH + 1) })
        .success,
    ).toBe(false);
  });

  it("rejects an empty message and a non-uuid conversationId", () => {
    expect(WidgetChatRequestSchema.safeParse({ ...base, message: "   " }).success).toBe(false);
    expect(
      WidgetChatRequestSchema.safeParse({ ...base, message: "hi", conversationId: "1" }).success,
    ).toBe(false);
  });
});
