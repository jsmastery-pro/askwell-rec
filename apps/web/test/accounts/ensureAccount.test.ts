import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const upsert = vi.hoisted(() =>
  vi.fn<(values: object, options: object) => Promise<{ error: { message: string } | null }>>(),
);
const from = vi.hoisted(() => vi.fn(() => ({ upsert })));
vi.mock("../../lib/supabase/service", () => ({ createServiceClient: () => ({ from }) }));

const { ensureAccount } = await import("../../lib/accounts");

describe("ensureAccount", () => {
  beforeEach(() => {
    from.mockClear();
    upsert.mockReset();
    upsert.mockResolvedValue({ error: null });
  });

  it("inserts the user on plan free, ignoring an existing row", async () => {
    await ensureAccount("user_123");
    expect(from).toHaveBeenCalledWith("accounts");
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      { clerk_user_id: "user_123", plan: "free" },
      { onConflict: "clerk_user_id", ignoreDuplicates: true },
    );
  });

  it("never sends a plan update for an existing row", async () => {
    await ensureAccount("user_123");
    await ensureAccount("user_123");
    for (const [, options] of upsert.mock.calls) {
      // ignoreDuplicates makes PostgREST send ON CONFLICT DO NOTHING, not DO UPDATE.
      expect(options).toMatchObject({ ignoreDuplicates: true });
    }
  });

  it("throws when the insert fails", async () => {
    upsert.mockResolvedValue({ error: { message: "permission denied" } });
    await expect(ensureAccount("user_123")).rejects.toThrow("ensureAccount: permission denied");
  });

  it("refuses an empty user ID without touching the database", async () => {
    await expect(ensureAccount("")).rejects.toThrow("missing clerkUserId");
    expect(from).not.toHaveBeenCalled();
  });
});
