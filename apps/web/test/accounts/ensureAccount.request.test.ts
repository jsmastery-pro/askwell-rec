import type { Database } from "@askwell/db";
import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// A real supabase-js client with fetch stubbed, so we check the HTTP request PostgREST gets.
const fetchMock = vi.hoisted(() =>
  vi.fn<typeof fetch>(async () => new Response(null, { status: 201 })),
);
vi.mock("../../lib/supabase/service", () => ({
  createServiceClient: () =>
    createClient<Database>("https://ref.supabase.co", "sb_secret_test", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchMock },
    }),
}));

const { ensureAccount } = await import("../../lib/accounts");

describe("ensureAccount request", () => {
  beforeEach(() => {
    fetchMock.mockClear();
  });

  it("is one POST with ON CONFLICT DO NOTHING on clerk_user_id, never a PATCH", async () => {
    await ensureAccount("user_123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0]!;
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);

    expect(init?.method).toBe("POST");
    expect(url.pathname).toBe("/rest/v1/accounts");
    expect(url.searchParams.get("on_conflict")).toBe("clerk_user_id");
    expect(headers.get("Prefer")).toContain("resolution=ignore-duplicates");
    expect(headers.get("Prefer")).not.toContain("merge-duplicates");
    expect(JSON.parse(String(init?.body))).toEqual({ clerk_user_id: "user_123", plan: "free" });
  });

  it("throws on a PostgREST error response", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ message: "permission denied for table accounts" }, { status: 403 }),
    );
    await expect(ensureAccount("user_123")).rejects.toThrow(
      "ensureAccount: permission denied for table accounts",
    );
  });
});
