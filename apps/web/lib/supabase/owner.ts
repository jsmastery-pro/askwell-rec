import "server-only";
import type { Database } from "@askwell/db";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase as the signed-in owner. Sends the Clerk session token (Supabase third-party auth),
 * so RLS sees `auth.jwt()->>'sub'` and scopes every read to the owner's rows.
 * Create one per request.
 */
export function createOwnerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !publishableKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);
  if (!url || !publishableKey) {
    throw new Error(`createOwnerClient: missing env ${missing.join(", ")}`);
  }

  return createClient<Database>(url, publishableKey, {
    // Signed out: null, so the request runs as `anon` and sees nothing.
    accessToken: async () => (await auth()).getToken(),
  });
}
