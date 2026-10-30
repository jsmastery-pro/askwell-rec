import "server-only";

/**
 * The app's own origin, with no trailing slash: where `/widget.js` and `/embed` are served.
 * A Vercel preview uses its own deployment URL, since every preview has a different address.
 * Everywhere else it is `NEXT_PUBLIC_APP_URL` (Production in Vercel, `http://localhost:3000`
 * locally).
 */
export function getAppUrl(): string {
  const previewHost = process.env.VERCEL_ENV === "preview" ? process.env.VERCEL_URL : undefined;
  const raw = previewHost ? `https://${previewHost}` : process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) {
    throw new Error("getAppUrl: missing env NEXT_PUBLIC_APP_URL (e.g. http://localhost:3000)");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`getAppUrl: not a URL: ${raw}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`getAppUrl: expected http(s), got ${url.protocol}`);
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}
