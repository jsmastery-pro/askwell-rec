import type { Database } from "@askwell/db";
import type { WidgetConfig } from "@askwell/shared";
import { createClient } from "@supabase/supabase-js";

/** A real supabase-js client with fetch stubbed, so tests see the HTTP request PostgREST gets. */
export function stubServiceClient(fetchMock: typeof fetch) {
  return createClient<Database>("https://ref.supabase.co", "sb_secret_test", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchMock },
  });
}

export const PUBLIC_KEY = "pk_test_abc12345";

/** A stored config different from `DEFAULT_WIDGET_CONFIG` in every field. */
export const CUSTOM_ROW = {
  button_color: "#ff5500",
  position: "top-left",
  label: "Ask us",
  animation: "slide",
  header_text: "Hi there",
  show_badge: false,
};

export const CUSTOM_CONFIG: WidgetConfig = {
  buttonColor: "#ff5500",
  position: "top-left",
  label: "Ask us",
  animation: "slide",
  headerText: "Hi there",
  showBadge: false,
};

/** What PostgREST returns for the project lookup. Includes ids a leak would expose. */
export function projectRows(plan: string | null, widgetConfig: object | null = CUSTOM_ROW) {
  return Response.json([
    {
      id: "11111111-1111-4111-8111-111111111111",
      owner_id: "user_owner",
      accounts: plan === null ? null : { plan },
      widget_configs:
        widgetConfig === null
          ? null
          : { project_id: "11111111-1111-4111-8111-111111111111", ...widgetConfig },
    },
  ]);
}
