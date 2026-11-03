import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WEB_ROOT = fileURLToPath(new URL("../..", import.meta.url));

// Tenant leak (§9): owner reads and writes go through the owner client. The service client
// (no RLS) is allowed only for the calls below, each after a check that the caller owns the
// rows. Owner-side code only: the public widget routes resolve projects by public key instead.
const SCANNED_DIRS = ["app/api/projects", "app/api/knowledge", "lib/projects", "lib/knowledge"];

/**
 * Every service-client call in SCANNED_DIRS, as `file: rpc(name)`, `file: from(table).op` or
 * `file: storage(bucket).op`.
 */
const ALLOWED = [
  // The owner is Clerk's userId from auth(); create_project counts and inserts for that owner.
  "app/api/projects/route.ts: rpc(create_project)",
  // After getOwnedProject (owner client, RLS) has returned the project.
  "app/api/projects/[id]/knowledge/route.ts: rpc(reserve_knowledge_source)",
  // processSource runs only for a source the route just reserved in an owned project.
  "lib/knowledge/process.ts: from(knowledge_chunks).insert",
  // Same source; filtered by source id and project id.
  "lib/knowledge/process.ts: from(knowledge_sources).update",
  // Same source; clears its chunks when processing fails.
  "lib/knowledge/process.ts: from(knowledge_chunks).delete",
];

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(join(WEB_ROOT, dir), { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => relative(WEB_ROOT, join(e.parentPath, e.name)));
}

/**
 * The service-client calls in one file. A client is either called inline
 * (`createServiceClient().rpc(…)`) or bound to a name (`const db = createServiceClient()`, or a
 * parameter typed `ReturnType<typeof createServiceClient>`). Any other use is returned as
 * `unknown`, so a call the scan can't follow fails the test instead of slipping through.
 */
export function serviceCalls(src: string): string[] {
  const calls: string[] = [];
  const names = new Set<string>();
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*createServiceClient\(\)/g))
    names.add(m[1]!);
  for (const m of src.matchAll(/(\w+)\s*:\s*ReturnType<typeof createServiceClient>/g))
    names.add(m[1]!);

  for (const m of src.matchAll(/createServiceClient\(\)/g)) {
    const before = src.slice(0, m.index);
    const after = src.slice(m.index + m[0].length);
    if (/(?:const|let)\s+\w+\s*=\s*$/.test(before)) continue; // bound to a name, read below
    if (!/^\s*\.(rpc\(|from\(|storage\s*\.from\()/.test(after)) {
      calls.push("unknown: createServiceClient() used another way");
    }
  }

  const receivers = ["createServiceClient\\(\\)", ...[...names]].join("|");
  const call = new RegExp(
    `(?:${receivers})\\s*\\.(?:rpc\\("(\\w+)"|from\\("(\\w+)"\\)\\s*\\.(select|insert|update|upsert|delete)\\(|storage\\s*\\.from\\("(\\w+)"\\)\\s*\\.(\\w+)\\()`,
    "g",
  );
  for (const m of src.matchAll(call)) {
    if (m[1]) calls.push(`rpc(${m[1]})`);
    else if (m[2]) calls.push(`from(${m[2]}).${m[3]}`);
    else calls.push(`storage(${m[4]}).${m[5]}`);
  }
  // A bound client used for anything but rpc/from (passed on, returned, …) can't be followed.
  for (const name of names) {
    const uses = [...src.matchAll(new RegExp(`\\b${name}\\b(?!\\s*:)`, "g"))].length;
    const followed = [
      ...src.matchAll(new RegExp(`\\b${name}\\s*\\.(?:rpc\\(|from\\(|storage\\s*\\.from\\()`, "g")),
    ].length;
    const bindings = [...src.matchAll(new RegExp(`(?:const|let)\\s+${name}\\s*=`, "g"))].length;
    // Passed as an argument: the callee's typed parameter is scanned in its own file.
    const passed = [...src.matchAll(new RegExp(`[(,]\\s*${name}\\s*[,)]`, "g"))].length;
    if (uses - followed - bindings - passed > 0) calls.push(`unknown: ${name} used another way`);
  }
  return calls;
}

describe("service client on the owner side", () => {
  it("is used only for the listed calls, and every listed call still exists", async () => {
    const found = new Set<string>();
    for (const dir of SCANNED_DIRS) {
      for (const file of await sourceFiles(dir).catch(() => [])) {
        const src = await readFile(join(WEB_ROOT, file), "utf8");
        for (const call of serviceCalls(src)) found.add(`${file}: ${call}`);
      }
    }
    // Unlisted calls show up on the left, stale entries on the right.
    expect([...found].sort()).toEqual([...ALLOWED].sort());
  });
});

describe("serviceCalls (the scanner itself)", () => {
  it("reads inline calls, named clients and typed parameters", () => {
    const src = `
      await createServiceClient().rpc("create_project", {});
      const db = createServiceClient();
      await db.from("knowledge_chunks")
        .insert(rows);
      async function f(client: ReturnType<typeof createServiceClient>) {
        await client.from("knowledge_sources").update({}).eq("id", 1);
      }
      await f(db);
      await createServiceClient().storage.from("knowledge").createSignedUploadUrl(key);
    `;
    expect(serviceCalls(src).sort()).toEqual([
      "from(knowledge_chunks).insert",
      "from(knowledge_sources).update",
      "rpc(create_project)",
      "storage(knowledge).createSignedUploadUrl",
    ]);
  });

  it("flags a client it can't follow", () => {
    expect(serviceCalls("return createServiceClient();")).toEqual([
      "unknown: createServiceClient() used another way",
    ]);
    expect(serviceCalls("const db = createServiceClient(); helpers.push(db.storage);")).toContain(
      "unknown: db used another way",
    );
  });
});
