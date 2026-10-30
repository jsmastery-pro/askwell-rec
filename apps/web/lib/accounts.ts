import "server-only";
import type { Plan } from "@askwell/shared";
import { createServiceClient } from "./supabase/service";

/**
 * Makes sure the Clerk user has an `accounts` row. Owners can't insert (§7), so this uses
 * the service client. ON CONFLICT DO NOTHING: an existing row, and its plan, is never touched.
 * Pass only the user ID from Clerk's server `auth()`. Throws on failure; the caller shows the error.
 */
export async function ensureAccount(clerkUserId: string): Promise<void> {
  if (!clerkUserId) throw new Error("ensureAccount: missing clerkUserId");

  const { error } = await createServiceClient()
    .from("accounts")
    .upsert(
      { clerk_user_id: clerkUserId, plan: "free" satisfies Plan },
      { onConflict: "clerk_user_id", ignoreDuplicates: true },
    );

  if (error) throw new Error(`ensureAccount: ${error.message}`, { cause: error });
}
