import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getAppUrl } = await import("../../lib/app-url");

describe("getAppUrl", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("VERCEL_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("on a Vercel preview, uses that deployment's own VERCEL_URL", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "askwell-rec-abc123-team.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://askwell.example");
    expect(getAppUrl()).toBe("https://askwell-rec-abc123-team.vercel.app");
  });

  it("in production, uses NEXT_PUBLIC_APP_URL, not VERCEL_URL", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "askwell-rec-abc123-team.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://askwell.example");
    expect(getAppUrl()).toBe("https://askwell.example");
  });

  it("locally (no VERCEL_ENV), uses NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("a preview without VERCEL_URL falls back to NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://askwell.example");
    expect(getAppUrl()).toBe("https://askwell.example");
  });

  it.each(["https://askwell.example/", "https://askwell.example//", "https://askwell.example"])(
    "never ends with a slash (%s)",
    (value) => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", value);
      expect(getAppUrl()).toBe("https://askwell.example");
    },
  );

  it("keeps a base path, without the trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com/askwell/");
    expect(getAppUrl()).toBe("https://example.com/askwell");
  });

  it("throws a clear error when both are missing", () => {
    expect(() => getAppUrl()).toThrow("getAppUrl: missing env NEXT_PUBLIC_APP_URL");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(() => getAppUrl()).toThrow("getAppUrl: missing env NEXT_PUBLIC_APP_URL");
  });

  it("throws on a value that isn't an http(s) URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "askwell.example");
    expect(() => getAppUrl()).toThrow("getAppUrl: not a URL");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "javascript:alert(1)");
    expect(() => getAppUrl()).toThrow("getAppUrl: expected http(s)");
  });
});
