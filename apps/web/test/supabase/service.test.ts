import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createClient = vi.fn<(url: string, key: string, options: object) => object>(() => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const { createServiceClient } = await import("../../lib/supabase/service");

// Built, not written out, so a grep for the secret key's name matches only service.ts.
const SECRET_ENV = ["SUPABASE", "SECRET", "KEY"].join("_");

const WEB_ROOT = fileURLToPath(new URL("../..", import.meta.url));

describe("createServiceClient", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ref.supabase.co");
    vi.stubEnv(SECRET_ENV, "sb_secret_test");
    createClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the secret key with no session persistence", () => {
    createServiceClient();
    expect(createClient).toHaveBeenCalledWith("https://ref.supabase.co", "sb_secret_test", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", SECRET_ENV])("throws when %s is missing", (name) => {
    vi.stubEnv(name, "");
    expect(() => createServiceClient()).toThrow(`missing env ${name}`);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("secret key containment", () => {
  async function sourceFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
      entries
        .filter((e) => !["node_modules", ".next"].includes(e.name))
        .map((e) => (e.isDirectory() ? sourceFiles(join(dir, e.name)) : [join(dir, e.name)])),
    );
    return nested.flat().filter((f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f));
  }

  it("only lib/supabase/service.ts reads the secret key, and it starts with server-only", async () => {
    const readers: string[] = [];
    for (const file of await sourceFiles(WEB_ROOT)) {
      if ((await readFile(file, "utf8")).includes(SECRET_ENV))
        readers.push(relative(WEB_ROOT, file));
    }
    expect(readers).toEqual(["lib/supabase/service.ts"]);

    const service = await readFile(join(WEB_ROOT, "lib/supabase/service.ts"), "utf8");
    expect(service.startsWith('import "server-only";')).toBe(true);
  });
});
