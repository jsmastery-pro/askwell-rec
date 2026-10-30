import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WEB_ROOT = fileURLToPath(new URL("../..", import.meta.url));

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(join(WEB_ROOT, dir), { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => relative(WEB_ROOT, join(e.parentPath, e.name)));
}

// Tenant leak (§9): owner reads and writes go through the owner client. The service client
// appears only for the create_project call, which owners can't make.
describe("projects code and the service client", () => {
  it("only POST /api/projects calls createServiceClient, once, for create_project", async () => {
    const calls: string[] = [];
    for (const file of [
      ...(await sourceFiles("app/api/projects")),
      ...(await sourceFiles("lib/projects")),
    ]) {
      const src = await readFile(join(WEB_ROOT, file), "utf8");
      for (const match of src.matchAll(/createServiceClient\(\)[^;]*/g)) {
        calls.push(`${file}: ${match[0].replace(/\s+/g, " ")}`);
      }
    }
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(
      /^app\/api\/projects\/route\.ts: createServiceClient\(\)\.rpc\("create_project"/,
    );
  });
});
