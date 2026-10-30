import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ChatRequestError,
  MOCK_REPLY,
  MOCK_REPLY_DELAY_MS,
  friendlyError,
  sendMessage,
} from "../../components/embed/chat-client";

const REQUEST = {
  key: "pk_test_abc12345",
  visitorId: "6f1c2a1e-6b0e-4c3a-9a43-1f7f3b1b9e10",
  message: "Hi there",
};

describe("sendMessage (Phase 2 mock)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("replies after ~800 ms with a canned reply and a new conversation ID", async () => {
    let settled = false;
    const pending = sendMessage(REQUEST).then((response) => {
      settled = true;
      return response;
    });
    await vi.advanceTimersByTimeAsync(MOCK_REPLY_DELAY_MS - 1);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(response.reply).toBe(MOCK_REPLY);
    expect(response.conversationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps an existing conversation ID", async () => {
    const conversationId = "0b8f3c55-2f1d-4f3e-8f53-5b2a7b0b4a11";
    const pending = sendMessage({ ...REQUEST, conversationId });
    await vi.advanceTimersByTimeAsync(MOCK_REPLY_DELAY_MS);
    expect((await pending).conversationId).toBe(conversationId);
  });

  it.each([
    ["/simulate rate_limited", "rate_limited"],
    ["/simulate quota_exceeded", "quota_exceeded"],
  ])("%s → a %s error after the delay", async (message, code) => {
    const pending = sendMessage({ ...REQUEST, message });
    const assertion = expect(pending).rejects.toMatchObject({ code });
    await vi.advanceTimersByTimeAsync(MOCK_REPLY_DELAY_MS);
    await assertion;
  });

  it.each([
    ["an empty message", { ...REQUEST, message: "   " }],
    ["a message over MESSAGE_MAX_LENGTH", { ...REQUEST, message: "x".repeat(1001) }],
    ["a bad visitor ID", { ...REQUEST, visitorId: "not-a-uuid" }],
    ["a bad key", { ...REQUEST, key: "nope" }],
  ])("rejects %s as invalid_input without waiting", async (_name, request) => {
    await expect(sendMessage(request)).rejects.toMatchObject({ code: "invalid_input" });
  });
});

describe("friendlyError", () => {
  it("has a friendly line for rate_limited and quota_exceeded", () => {
    expect(friendlyError(new ChatRequestError("rate_limited", "x"))).toMatch(/a little fast/);
    expect(friendlyError(new ChatRequestError("quota_exceeded", "x"))).toMatch(/right now/);
  });

  it("never shows the raw error", () => {
    expect(friendlyError(new Error("db exploded at row 42"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(friendlyError(new ChatRequestError("internal", "stack trace"))).not.toContain("stack");
  });
});
