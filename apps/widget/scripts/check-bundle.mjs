// Fails the build if dist/widget.js breaks the loader's budget or rules (§3, §9).
import { readFileSync } from "node:fs";
import { exit, stderr, stdout } from "node:process";
import { URL } from "node:url";
import { gzipSync } from "node:zlib";

const MAX_GZIP_BYTES = 5 * 1024;
const bundle = readFileSync(new URL("../dist/widget.js", import.meta.url));
const source = bundle.toString("utf8");
const gzipBytes = gzipSync(bundle, { level: 9 }).length;

const problems = [];
if (gzipBytes >= MAX_GZIP_BYTES)
  problems.push(`${gzipBytes} B gzipped, limit is under ${MAX_GZIP_BYTES} B`);
if (/zod/i.test(source)) problems.push("bundle contains zod: import only @askwell/shared/embed");
if (/postMessage\([^)]*,\s*["'`]\*["'`]/.test(source)) problems.push('postMessage to "*"');

if (problems.length) {
  stderr.write(`widget.js check failed:\n- ${problems.join("\n- ")}\n`);
  exit(1);
}
stdout.write(`widget.js: ${bundle.length} B, ${gzipBytes} B gzipped (limit ${MAX_GZIP_BYTES} B)\n`);
