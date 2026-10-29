export const SIGN_IN_URL = "/sign-in";
export const SIGN_UP_URL = "/sign-up";
export const AFTER_SIGN_IN_URL = "/dashboard";
export const AFTER_SIGN_UP_URL = "/dashboard";
export const AFTER_SIGN_OUT_URL = "/sign-in";

export type RouteAccess = "public" | "protected-page" | "protected-api";

// A prefix matches the path itself and everything under it, never a sibling
// (`/dashboard` matches `/dashboard/x`, not `/dashboardx`).
const PROTECTED_PAGE_PREFIXES = ["/dashboard"];
const PROTECTED_API_PREFIXES = ["/api/projects", "/api/knowledge", "/api/conversations"];

const PUBLIC_PREFIXES = [SIGN_IN_URL, SIGN_UP_URL, "/embed", "/api/widget"];
const PUBLIC_EXACT = ["/", "/api/clerk/webhook", "/api/posthog-config"];

function normalize(pathname: string): string {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // Malformed escape: keep the raw path.
  }
  path = path.replace(/\/{2,}/g, "/");
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function matchesPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isProtectedPage(pathname: string): boolean {
  return matchesPrefix(normalize(pathname), PROTECTED_PAGE_PREFIXES);
}

export function isProtectedApi(pathname: string): boolean {
  return matchesPrefix(normalize(pathname), PROTECTED_API_PREFIXES);
}

export function isPublicRoute(pathname: string): boolean {
  const path = normalize(pathname);
  return PUBLIC_EXACT.includes(path) || matchesPrefix(path, PUBLIC_PREFIXES);
}

/**
 * How `proxy.ts` treats a request path.
 * Any `/api` route that is neither listed protected nor listed public is treated as protected,
 * so a new API route is closed until someone opens it on purpose.
 */
export function getRouteAccess(pathname: string): RouteAccess {
  if (isProtectedPage(pathname)) return "protected-page";
  if (isProtectedApi(pathname)) return "protected-api";
  if (isPublicRoute(pathname)) return "public";
  const path = normalize(pathname);
  return path === "/api" || path.startsWith("/api/") ? "protected-api" : "public";
}
