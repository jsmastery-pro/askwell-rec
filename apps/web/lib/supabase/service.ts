import "server-only";
import type { Database } from "@askwell/db";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase with the secret key: bypasses RLS. Server only, and only after the route has
 * checked ownership and plan. Never use it for owner reads with a manual owner filter.
 * The only file that reads SUPABASE_SECRET_KEY.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const missing = [!url && "NEXT_PUBLIC_SUPABASE_URL", !secretKey && "SUPABASE_SECRET_KEY"].filter(
    Boolean,
  );
  if (!url || !secretKey) {
    throw new Error(`createServiceClient: missing env ${missing.join(", ")}`);
  }

  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
