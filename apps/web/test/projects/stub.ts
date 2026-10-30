import type { Database } from "@askwell/db";
import { createClient } from "@supabase/supabase-js";

/** A real supabase-js client with fetch stubbed, so tests see the HTTP request PostgREST gets. */
export function stubClient(fetchMock: typeof fetch) {
  return createClient<Database>("https://ref.supabase.co", "sb_test", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchMock },
  });
}

export const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
export const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";

/** A `projects` row as PostgREST returns it (Postgres timestamps, snake_case). */
export function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    name: "Docs bot",
    public_key: "pk_AbCdEfGhIjKlMnOpQrStUvWxYz012345",
    messages_used: 3,
    period_start: "2026-10-01T00:00:00+00:00",
    created_at: "2026-10-30T09:38:35.123456+00:00",
    ...overrides,
  };
}

export const PROJECT = {
  id: PROJECT_ID,
  name: "Docs bot",
  publicKey: "pk_AbCdEfGhIjKlMnOpQrStUvWxYz012345",
  messagesUsed: 3,
  periodStart: "2026-10-01T00:00:00+00:00",
  createdAt: "2026-10-30T09:38:35.123456+00:00",
};

export function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export const routeContext = (id: string) => ({ params: Promise.resolve({ id }) });

export function requestOf(fetchMock: { mock: { calls: Parameters<typeof fetch>[] } }, i = 0) {
  const [input, init] = fetchMock.mock.calls[i]!;
  return {
    method: init?.method ?? "GET",
    url: new URL(String(input)),
    body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
  };
}
