import { CreateProjectResponseSchema } from "@askwell/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendJson } from "../../components/projects/api";
import { PROJECT } from "../projects/stub";

const fetchMock = vi.fn<typeof fetch>();

describe("sendJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const send = () =>
    sendJson("/api/projects", "POST", CreateProjectResponseSchema, { name: "Docs bot" });

  it("sends JSON and returns the parsed body on success", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(Response.json({ project: PROJECT }, { status: 201 }));

    expect(await send()).toEqual({ ok: true, data: { project: PROJECT } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/projects");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(init?.body).toBe('{"name":"Docs bot"}');
  });

  it("returns the API error code and message", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: { code: "limit_reached", message: "Limit." } }, { status: 403 }),
    );
    expect(await send()).toEqual({ ok: false, code: "limit_reached", message: "Limit." });
  });

  it("a non-JSON error is internal", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 502 }));
    expect(await send()).toEqual({ ok: false, code: "internal", message: "HTTP 502" });
  });

  it("a network failure or an unexpected success body is internal, never a throw", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await send()).toMatchObject({ ok: false, code: "internal" });

    fetchMock.mockResolvedValueOnce(Response.json({ nope: true }));
    expect(await send()).toMatchObject({ ok: false, code: "internal" });
  });

  it("a DELETE sends no body or content-type", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(Response.json({ project: PROJECT }));
    await sendJson("/api/projects/x", "DELETE", CreateProjectResponseSchema);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toBeUndefined();
  });
});
