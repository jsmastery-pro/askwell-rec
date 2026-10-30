import { describe, expect, it } from "vitest";
import {
  EMBED_MESSAGE_TYPES,
  EMBED_PATH,
  VISITOR_ID_STORAGE_KEY,
  WIDGET_CONFIG_PATH,
  WIDGET_POSITIONS,
  isEmbedMessage,
} from "../src/embed";
import pkg from "../package.json";
import * as main from "../src";

describe("embed constants", () => {
  it("names the panel path, config path and visitor ID key", () => {
    expect(EMBED_PATH).toBe("/embed");
    expect(WIDGET_CONFIG_PATH).toBe("/api/widget/config");
    expect(VISITOR_ID_STORAGE_KEY).toBe("askwell:visitor-id");
  });

  it("re-exports the same widget options as the main entry", () => {
    expect(WIDGET_POSITIONS).toBe(main.WIDGET_POSITIONS);
  });
});

describe("isEmbedMessage", () => {
  it.each([
    { type: "askwell:init" },
    { type: "askwell:close" },
    { type: "askwell:resize", height: 0 },
    { type: "askwell:resize", height: 412.5 },
    { type: "askwell:unread", count: 0 },
    { type: "askwell:unread", count: 3 },
  ])("accepts %o", (message) => {
    expect(isEmbedMessage(message)).toBe(true);
  });

  it.each([
    null,
    undefined,
    "askwell:close",
    42,
    {},
    { type: "askwell:open" },
    { type: "other:close" },
    { type: "askwell:resize" },
    { type: "askwell:resize", height: "100" },
    { type: "askwell:resize", height: -1 },
    { type: "askwell:resize", height: Number.NaN },
    { type: "askwell:resize", height: Number.POSITIVE_INFINITY },
    { type: "askwell:unread" },
    { type: "askwell:unread", count: 1.5 },
    { type: "askwell:unread", count: -1 },
    { type: "askwell:unread", count: "2" },
  ])("rejects %o", (message) => {
    expect(isEmbedMessage(message)).toBe(false);
  });

  it("covers every message type", () => {
    expect([...EMBED_MESSAGE_TYPES].sort()).toEqual(
      ["askwell:close", "askwell:init", "askwell:resize", "askwell:unread"].sort(),
    );
  });
});

describe("package exports", () => {
  it("has `@askwell/shared/embed` as its own entry", () => {
    expect(pkg.exports["./embed"]).toBe("./src/embed.ts");
  });
});
