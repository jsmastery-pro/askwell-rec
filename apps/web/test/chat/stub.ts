import type { Database } from "@askwell/db";
import { createClient } from "@supabase/supabase-js";
import { vi } from "vitest";

export const PUBLIC_KEY = "pk_test_abc12345";
export const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
export const VISITOR_ID = "6f1c2a1e-6b0e-4c3a-9a43-1f7f3b1b9e10";
export const CONVERSATION_ID = "0b8f3c55-2f1d-4f3e-8f53-5b2a7b0b4a11";
export const OTHER_CONVERSATION_ID = "9a1d7e0c-3b7a-4c55-9a2e-6f0e1d2c3b4a";

/** Seeded chunks: two related to shipping, one unrelated (below the minimum similarity). */
export const SEEDED_CHUNKS = [
  { content: "We ship to Canada in 5 business days.", similarity: 0.62 },
  { content: "Shipping is free over $50.", similarity: 0.41 },
  { content: "Our office dog is called Biscuit.", similarity: 0.12 },
];

type Handler = (body: unknown, url: URL) => Response | Promise<Response>;

/**
 * A fake PostgREST: answers each path (`projects`, `conversations`, `rpc/<fn>`) from `routes`,
 * and records every call. Any other path is a test failure.
 */
export function fakePostgrest() {
  const calls: Array<{ path: string; url: URL; body: unknown }> = [];
  const routes: Record<string, Handler> = {};
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname.replace("/rest/v1/", "");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, url, body });
    const handler = routes[path];
    if (!handler) throw new Error(`unexpected PostgREST call: ${path}`);
    return handler(body, url);
  });
  const client = createClient<Database>("https://ref.supabase.co", "sb_secret_test", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchMock },
  });
  return {
    client,
    routes,
    calls,
    called: (path: string) => calls.filter((call) => call.path === path),
    reset() {
      calls.length = 0;
      fetchMock.mockClear();
      for (const path of Object.keys(routes)) delete routes[path];
    },
  };
}

export const projectRow = (plan: string | null = "free") =>
  Response.json([{ id: PROJECT_ID, accounts: plan === null ? null : { plan } }]);

/** PostgREST's body for a `raise exception … using errcode = 'P0001'`. */
export const conversationNotFound = () =>
  Response.json(
    { code: "P0001", message: "conversation_not_found", details: null, hint: null },
    { status: 400 },
  );
