import { PLAN_LIMITS } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONVERSATION_ID,
  PROJECT_ID,
  PUBLIC_KEY,
  SEEDED_CHUNKS,
  VISITOR_ID,
  conversationNotFound,
  fakePostgrest,
  projectRow,
} from "./stub";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
  current: undefined as ReturnType<typeof fakePostgrest> | undefined,
}));
vi.mock("../../lib/supabase/service", () => ({ createServiceClient: () => db.current!.client }));
db.current = fakePostgrest();
const pg = db.current;

const chat = await import("../../lib/chat");

beforeEach(() => pg.reset());

describe("getChatProject", () => {
  it("looks the project up by public_key only and returns its id and plan", async () => {
    pg.routes.projects = () => projectRow("pro");
    expect(await chat.getChatProject(PUBLIC_KEY)).toEqual({ id: PROJECT_ID, plan: "pro" });

    const { url } = pg.called("projects")[0]!;
    expect(url.searchParams.get("public_key")).toBe(`eq.${PUBLIC_KEY}`);
    expect([...url.searchParams.keys()].sort()).toEqual(["public_key", "select"]);
    expect(url.searchParams.get("select")).toBe("id,accounts(plan)");
  });

  it("unknown key → null", async () => {
    pg.routes.projects = () => Response.json([]);
    expect(await chat.getChatProject(PUBLIC_KEY)).toBeNull();
  });

  it.each([null, "enterprise"])("a missing or unknown plan (%j) → free", async (plan) => {
    pg.routes.projects = () => projectRow(plan);
    expect(await chat.getChatProject(PUBLIC_KEY)).toEqual({ id: PROJECT_ID, plan: "free" });
  });
});

describe("conversationInProject", () => {
  it("filters on both the conversation id and the project id", async () => {
    pg.routes.conversations = () => Response.json([{ id: CONVERSATION_ID }]);
    expect(await chat.conversationInProject(PROJECT_ID, CONVERSATION_ID)).toBe(true);

    const { url } = pg.called("conversations")[0]!;
    expect(url.searchParams.get("id")).toBe(`eq.${CONVERSATION_ID}`);
    expect(url.searchParams.get("project_id")).toBe(`eq.${PROJECT_ID}`);
  });

  it("no row → false", async () => {
    pg.routes.conversations = () => Response.json([]);
    expect(await chat.conversationInProject(PROJECT_ID, CONVERSATION_ID)).toBe(false);
  });
});

describe("consumeMessage", () => {
  it.each(["free", "pro"] as const)("passes the %s plan's monthly limit", async (plan) => {
    pg.routes["rpc/consume_message"] = () => Response.json(true);
    expect(await chat.consumeMessage({ id: PROJECT_ID, plan })).toBe(true);
    expect(pg.called("rpc/consume_message")[0]!.body).toEqual({
      p_project_id: PROJECT_ID,
      p_limit: PLAN_LIMITS[plan].messagesPerMonthPerProject,
    });
  });

  it("at the limit → false", async () => {
    pg.routes["rpc/consume_message"] = () => Response.json(false);
    expect(await chat.consumeMessage({ id: PROJECT_ID, plan: "free" })).toBe(false);
  });
});

describe("matchChunks", () => {
  it("sends the embedding as a pgvector literal and asks for 5 chunks", async () => {
    pg.routes["rpc/match_chunks"] = () => Response.json(SEEDED_CHUNKS);
    await chat.matchChunks(PROJECT_ID, [0.25, -0.5, 1]);
    expect(pg.called("rpc/match_chunks")[0]!.body).toEqual({
      p_project_id: PROJECT_ID,
      p_embedding: "[0.25,-0.5,1]",
      p_count: chat.MATCH_CHUNK_COUNT,
    });
    expect(chat.MATCH_CHUNK_COUNT).toBe(5);
  });

  it("keeps only seeded chunks at or above MIN_CHUNK_SIMILARITY, in order", async () => {
    pg.routes["rpc/match_chunks"] = () =>
      Response.json([
        ...SEEDED_CHUNKS,
        { content: "Exactly at the line.", similarity: chat.MIN_CHUNK_SIMILARITY },
      ]);
    expect(await chat.matchChunks(PROJECT_ID, [1])).toEqual([
      { content: "We ship to Canada in 5 business days." },
      { content: "Shipping is free over $50." },
      { content: "Exactly at the line." },
    ]);
  });

  it("no ready chunks → []", async () => {
    pg.routes["rpc/match_chunks"] = () => Response.json([]);
    expect(await chat.matchChunks(PROJECT_ID, [1])).toEqual([]);
  });
});

describe("saveChatTurn", () => {
  const turn = {
    projectId: PROJECT_ID,
    visitorId: VISITOR_ID,
    visitorBody: "Do you ship to Canada?",
    botBody: "Yes, in 5 business days.",
  };

  it("first message: sends a null conversation id and returns the new one", async () => {
    pg.routes["rpc/save_chat_turn"] = () => Response.json(CONVERSATION_ID);
    expect(await chat.saveChatTurn({ ...turn, conversationId: null })).toBe(CONVERSATION_ID);
    expect(pg.called("rpc/save_chat_turn")[0]!.body).toEqual({
      p_project_id: PROJECT_ID,
      p_conversation_id: null,
      p_visitor_id: VISITOR_ID,
      p_visitor_body: turn.visitorBody,
      p_bot_body: turn.botBody,
    });
  });

  it("conversation_not_found (P0001) → ConversationNotFoundError", async () => {
    pg.routes["rpc/save_chat_turn"] = conversationNotFound;
    await expect(
      chat.saveChatTurn({ ...turn, conversationId: CONVERSATION_ID }),
    ).rejects.toBeInstanceOf(chat.ConversationNotFoundError);
  });

  it("any other error → a plain Error", async () => {
    pg.routes["rpc/save_chat_turn"] = () =>
      Response.json({ code: "XX000", message: "boom" }, { status: 500 });
    const error = await chat
      .saveChatTurn({ ...turn, conversationId: null })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(chat.ConversationNotFoundError);
  });
});
