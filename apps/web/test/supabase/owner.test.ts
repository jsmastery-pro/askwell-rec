import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getToken = vi.fn<() => Promise<string | null>>();
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ getToken }) }));

type Options = { accessToken?: () => Promise<string | null> };
const createClient = vi.fn<(url: string, key: string, options: Options) => object>(() => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const { createOwnerClient } = await import("../../lib/supabase/owner");

describe("createOwnerClient", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    createClient.mockClear();
    getToken.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the URL and the publishable key", () => {
    createOwnerClient();
    expect(createClient).toHaveBeenCalledWith(
      "https://ref.supabase.co",
      "sb_publishable_test",
      expect.any(Object),
    );
  });

  it("passes Clerk's session token through accessToken", async () => {
    getToken.mockResolvedValue("clerk_session_token");
    createOwnerClient();
    const options = createClient.mock.calls[0]?.[2];
    await expect(options?.accessToken?.()).resolves.toBe("clerk_session_token");
    expect(getToken).toHaveBeenCalledWith();
  });

  it("passes null when signed out", async () => {
    getToken.mockResolvedValue(null);
    createOwnerClient();
    await expect(createClient.mock.calls[0]?.[2].accessToken?.()).resolves.toBeNull();
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"])(
    "throws when %s is missing",
    (name) => {
      vi.stubEnv(name, "");
      expect(() => createOwnerClient()).toThrow(`missing env ${name}`);
      expect(createClient).not.toHaveBeenCalled();
    },
  );
});
