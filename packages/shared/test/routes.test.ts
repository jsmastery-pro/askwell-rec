import { describe, expect, it } from "vitest";
import {
  API_ERROR_CODES,
  API_ERROR_STATUS,
  ApiErrorSchema,
  CreateProjectRequestSchema,
  GetConversationResponseSchema,
  IdParamsSchema,
  ListConversationsResponseSchema,
  ListProjectsResponseSchema,
} from "../src";

const now = "2026-10-29T12:00:00.000+00:00";
const projectId = "3f0b8f4e-6a1c-4d2b-9a57-0e1f2a3b4c5d";
const conversation = {
  id: "8c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
  projectId,
  visitorId: "v1",
  createdAt: now,
};

describe("projects", () => {
  it("create needs a non-empty name", () => {
    expect(CreateProjectRequestSchema.safeParse({ name: "Docs site" }).success).toBe(true);
    expect(CreateProjectRequestSchema.safeParse({ name: "  " }).success).toBe(false);
  });

  it("list response parses a project", () => {
    const project = {
      id: projectId,
      name: "Docs site",
      publicKey: "pk_abcdef123456",
      messagesUsed: 0,
      periodStart: now,
      createdAt: now,
    };
    expect(ListProjectsResponseSchema.parse({ projects: [project] })).toEqual({
      projects: [project],
    });
  });

  it("path id must be a uuid", () => {
    expect(IdParamsSchema.safeParse({ id: projectId }).success).toBe(true);
    expect(IdParamsSchema.safeParse({ id: "1" }).success).toBe(false);
  });
});

describe("conversations", () => {
  it("list and thread responses parse", () => {
    expect(
      ListConversationsResponseSchema.safeParse({
        conversations: [{ ...conversation, preview: "Hi", messageCount: 2 }],
      }).success,
    ).toBe(true);
    expect(
      GetConversationResponseSchema.safeParse({
        conversation,
        messages: [
          {
            id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
            conversationId: conversation.id,
            role: "bot",
            body: "Hello",
            createdAt: now,
          },
        ],
      }).success,
    ).toBe(true);
  });
});

describe("ApiError", () => {
  it("every code has a status; plan_required is 402", () => {
    expect(Object.keys(API_ERROR_STATUS).sort()).toEqual([...API_ERROR_CODES].sort());
    expect(API_ERROR_STATUS.plan_required).toBe(402);
  });

  it("rejects an unknown code", () => {
    expect(
      ApiErrorSchema.safeParse({ error: { code: "not_found", message: "No project" } }).success,
    ).toBe(true);
    expect(ApiErrorSchema.safeParse({ error: { code: "oops", message: "x" } }).success).toBe(false);
  });
});
