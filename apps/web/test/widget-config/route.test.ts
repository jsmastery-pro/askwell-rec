import { ApiErrorSchema, DEFAULT_WIDGET_CONFIG, WidgetConfigResponseSchema } from "@askwell/shared";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_CONFIG, PUBLIC_KEY, projectRows } from "./stub";

vi.mock("server-only", () => ({}));

const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock("../../lib/supabase/service", async () => {
  const { stubServiceClient } = await import("./stub");
  return { createServiceClient: () => stubServiceClient(fetchMock) };
});

const { GET, OPTIONS } = await import("../../app/api/widget/config/route");

function get(query: string) {
  return GET(new NextRequest(`https://askwell.test/api/widget/config${query}`));
}

function expectPublicHeaders(res: Response) {
  expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  expect(res.headers.get("Cache-Control")).toBe("no-store");
}

describe("GET /api/widget/config", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(Response.json([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Pro owner → 200 with the stored config", async () => {
    fetchMock.mockResolvedValueOnce(projectRows("pro"));
    const res = await get(`?key=${PUBLIC_KEY}`);

    expect(res.status).toBe(200);
    expectPublicHeaders(res);
    const body = await res.json();
    expect(WidgetConfigResponseSchema.strict().parse(body)).toEqual({ config: CUSTOM_CONFIG });
  });

  it("Free owner with a custom stored config → 200 with DEFAULT_WIDGET_CONFIG", async () => {
    fetchMock.mockResolvedValueOnce(projectRows("free"));
    const res = await get(`?key=${PUBLIC_KEY}`);

    expect(res.status).toBe(200);
    expectPublicHeaders(res);
    expect(await res.json()).toEqual({ config: DEFAULT_WIDGET_CONFIG });
  });

  it("the body holds only `config`: no id, ownerId or projectId", async () => {
    fetchMock.mockResolvedValueOnce(projectRows("pro"));
    const text = await (await get(`?key=${PUBLIC_KEY}`)).text();
    const body = JSON.parse(text) as Record<string, unknown>;

    expect(Object.keys(body)).toEqual(["config"]);
    for (const leak of ["id", "ownerId", "owner_id", "projectId", "project_id"]) {
      expect(text).not.toContain(`"${leak}"`);
    }
    expect(text).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(text).not.toContain("user_owner");
  });

  it("unknown key → 404 not_found JSON with CORS", async () => {
    const res = await get("?key=pk_doesnotexist123");

    expect(res.status).toBe(404);
    expectPublicHeaders(res);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("not_found");
  });

  it.each([
    ["malformed key", "?key=not-a-key"],
    ["too short", "?key=pk_abc"],
    ["missing key", ""],
    ["empty key", "?key="],
  ])("%s → 400 invalid_input JSON with CORS, no database call", async (_, query) => {
    const res = await get(query);

    expect(res.status).toBe(400);
    expectPublicHeaders(res);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("invalid_input");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("database error → 500 internal JSON with CORS, no detail leaked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(
      Response.json({ message: "permission denied for table projects" }, { status: 403 }),
    );
    const res = await get(`?key=${PUBLIC_KEY}`);

    expect(res.status).toBe(500);
    expectPublicHeaders(res);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("internal");
    expect(body.error.message).not.toContain("permission denied");
  });
});

describe("OPTIONS /api/widget/config", () => {
  it("→ 204 with CORS headers and no body", async () => {
    const res = OPTIONS();

    expect(res.status).toBe(204);
    expectPublicHeaders(res);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS");
    expect(await res.text()).toBe("");
  });
});
