import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_ENDPOINT,
  ChatRequestError,
  friendlyError,
  sendMessage,
} from "../../components/embed/chat-client";

const REQUEST = {
  key: "pk_test_abc12345",
  visitorId: "6f1c2a1e-6b0e-4c3a-9a43-1f7f3b1b9e10",
  message: "Hi there",
};
const CONVERSATION_ID = "0b8f3c55-2f1d-4f3e-8f53-5b2a7b0b4a11";

const fetchMock = vi.fn<typeof fetch>();

const apiError = (code: string, status: number) =>
  Response.json({ error: { code, message: "server detail" } }, { status });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendMessage", () => {
  it("posts the request as JSON to the same-origin chat route and returns the reply", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ conversationId: CONVERSATION_ID, reply: "We ship in 3 days." }),
    );

    const response = await sendMessage({ ...REQUEST, conversationId: CONVERSATION_ID });

    expect(response).toEqual({ conversationId: CONVERSATION_ID, reply: "We ship in 3 days." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(CHAT_ENDPOINT);
    expect(CHAT_ENDPOINT).toBe("/api/widget/chat");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ ...REQUEST, conversationId: CONVERSATION_ID });
  });

  it("omits conversationId on the first message", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ conversationId: CONVERSATION_ID, reply: "Hi" }),
    );
    await sendMessage(REQUEST);
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual(REQUEST);
  });

  it.each([
    ["rate_limited", 429],
    ["quota_exceeded", 429],
    ["blocked", 403],
    ["not_found", 404],
    ["internal", 500],
  ])("an API %s error rejects with that code", async (code, status) => {
    fetchMock.mockResolvedValueOnce(apiError(code, status));
    await expect(sendMessage(REQUEST)).rejects.toMatchObject({ code });
  });

  it("a network error rejects as internal", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(sendMessage(REQUEST)).rejects.toMatchObject({ code: "internal" });
  });

  it.each([
    ["a non-JSON error body", new Response("<html>502</html>", { status: 502 })],
    ["a 200 that isn't a chat response", Response.json({ reply: 42 })],
    ["a 200 with a bad conversationId", Response.json({ conversationId: "x", reply: "Hi" })],
    ["a 200 that isn't JSON", new Response("ok")],
  ])("%s rejects as internal", async (_name, response) => {
    fetchMock.mockResolvedValueOnce(response);
    await expect(sendMessage(REQUEST)).rejects.toMatchObject({ code: "internal" });
  });

  it.each([
    ["an empty message", { ...REQUEST, message: "   " }],
    ["a message over MESSAGE_MAX_LENGTH", { ...REQUEST, message: "x".repeat(1001) }],
    ["a bad visitor ID", { ...REQUEST, visitorId: "not-a-uuid" }],
    ["a bad key", { ...REQUEST, key: "nope" }],
  ])("rejects %s as invalid_input without a request", async (_name, request) => {
    await expect(sendMessage(request)).rejects.toMatchObject({ code: "invalid_input" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("friendlyError", () => {
  it.each([
    ["rate_limited", "You're sending messages too fast. Try again in a minute."],
    ["quota_exceeded", "This assistant has reached its message limit for this month."],
    ["blocked", "I can't help with that."],
    ["internal", "Something went wrong. Please try again."],
    ["not_found", "Something went wrong. Please try again."],
  ] as const)("%s → %j", (code, text) => {
    expect(friendlyError(new ChatRequestError(code, "x"))).toBe(text);
  });

  it("never shows the raw error", () => {
    expect(friendlyError(new Error("db exploded at row 42"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(friendlyError(new ChatRequestError("internal", "stack trace"))).not.toContain("stack");
  });
});
