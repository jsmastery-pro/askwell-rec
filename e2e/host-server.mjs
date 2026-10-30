// Serves e2e/host/index.html on its own origin (default http://127.0.0.1:4173), so the widget
// runs cross-origin like on a customer's site. The snippet's {APP_URL} and {KEY} are filled from
// E2E_APP_URL and E2E_PUBLIC_KEY at request time; `/?key=...` overrides the key (bad-key test).
// Keys come from env only: never commit one.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { env, exit, stderr, stdout } from "node:process";
import { URL } from "node:url";

const PORT = Number(env.E2E_HOST_PORT ?? 4173);
const HOST = "127.0.0.1";
const appUrl = env.E2E_APP_URL?.replace(/\/+$/, "");
const defaultKey = env.E2E_PUBLIC_KEY;

if (!appUrl || !defaultKey) {
  stderr.write("host-server: set E2E_APP_URL and E2E_PUBLIC_KEY\n");
  exit(1);
}

const template = readFileSync(new URL("./host/index.html", import.meta.url), "utf8");

const escapeAttribute = (value) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  if (url.pathname !== "/") {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    return;
  }
  const key = url.searchParams.get("key") ?? defaultKey;
  const html = template
    .replaceAll("{APP_URL}", escapeAttribute(appUrl))
    .replaceAll("{KEY}", escapeAttribute(key));
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(html);
}).listen(PORT, HOST, () => {
  stdout.write(`host-server: http://${HOST}:${PORT} → widget from ${appUrl}\n`);
});
