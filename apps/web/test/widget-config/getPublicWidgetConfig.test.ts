import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOM_CONFIG, CUSTOM_ROW, PUBLIC_KEY, projectRows } from "./stub";

vi.mock("server-only", () => ({}));

const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock("../../lib/supabase/service", async () => {
  const { stubServiceClient } = await import("./stub");
  return { createServiceClient: () => stubServiceClient(fetchMock) };
});

const { getPublicWidgetConfig } = await import("../../lib/widget-config");

describe("getPublicWidgetConfig", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(Response.json([]));
  });

  it("looks the project up by public_key only, selecting no ids", async () => {
    fetchMock.mockResolvedValueOnce(projectRows("pro"));
    await getPublicWidgetConfig(PUBLIC_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0]!;
    const url = new URL(String(input));
    expect(init?.method ?? "GET").toBe("GET");
    expect(url.pathname).toBe("/rest/v1/projects");
    expect(url.searchParams.get("public_key")).toBe(`eq.${PUBLIC_KEY}`);
    expect([...url.searchParams.keys()].sort()).toEqual(["public_key", "select"]);

    const select = url.searchParams.get("select")!;
    expect(select).toContain("accounts(plan)");
    expect(select).toContain("widget_configs(");
    expect(select).not.toMatch(/\bid\b|owner_id|project_id/);
  });

  it("Free owner with a custom stored config gets DEFAULT_WIDGET_CONFIG", async () => {
    fetchMock.mockResolvedValueOnce(projectRows("free"));
    expect(await getPublicWidgetConfig(PUBLIC_KEY)).toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("Pro owner gets the stored config, camelCased", async () => {
    fetchMock.mockResolvedValueOnce(projectRows("pro"));
    expect(await getPublicWidgetConfig(PUBLIC_KEY)).toEqual(CUSTOM_CONFIG);
  });

  it("returns only the config fields, never ids", async () => {
    fetchMock.mockResolvedValueOnce(projectRows("pro"));
    const config = await getPublicWidgetConfig(PUBLIC_KEY);
    expect(Object.keys(config!).sort()).toEqual(
      ["animation", "buttonColor", "headerText", "label", "position", "showBadge"].sort(),
    );
  });

  it("an unknown plan value gets Free's defaults", async () => {
    fetchMock.mockResolvedValueOnce(projectRows("enterprise"));
    expect(await getPublicWidgetConfig(PUBLIC_KEY)).toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("a missing account gets Free's defaults", async () => {
    fetchMock.mockResolvedValueOnce(projectRows(null));
    expect(await getPublicWidgetConfig(PUBLIC_KEY)).toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("Pro with no widget_configs row gets the defaults", async () => {
    fetchMock.mockResolvedValueOnce(projectRows("pro", null));
    expect(await getPublicWidgetConfig(PUBLIC_KEY)).toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("Pro with an invalid stored row gets the defaults", async () => {
    fetchMock.mockResolvedValueOnce(projectRows("pro", { ...CUSTOM_ROW, position: "middle" }));
    expect(await getPublicWidgetConfig(PUBLIC_KEY)).toEqual(DEFAULT_WIDGET_CONFIG);
  });

  it("returns null for an unknown key", async () => {
    expect(await getPublicWidgetConfig(PUBLIC_KEY)).toBeNull();
  });

  it("throws on a PostgREST error", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ message: "permission denied for table projects" }, { status: 403 }),
    );
    await expect(getPublicWidgetConfig(PUBLIC_KEY)).rejects.toThrow(
      "getPublicWidgetConfig: permission denied for table projects",
    );
  });
});
