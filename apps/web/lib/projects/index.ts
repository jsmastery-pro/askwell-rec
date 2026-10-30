import "server-only";
import type { Tables } from "@askwell/db";
import type { Project } from "@askwell/shared";
import { createOwnerClient } from "../supabase/owner";

/** The `projects` columns a `Project` is built from. Never `owner_id`. */
export const PROJECT_COLUMNS = "id, name, public_key, messages_used, period_start, created_at";

export type ProjectRow = Pick<
  Tables<"projects">,
  "id" | "name" | "public_key" | "messages_used" | "period_start" | "created_at"
>;

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    publicKey: row.public_key,
    messagesUsed: row.messages_used,
    periodStart: row.period_start,
    createdAt: row.created_at,
  };
}

/**
 * The signed-in owner's project, or `null` if it doesn't exist or isn't theirs.
 * Reads through the owner client, so RLS does the scoping: no manual owner filter.
 */
export async function getOwnedProject(projectId: string): Promise<Project | null> {
  const { data, error } = await createOwnerClient()
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(`getOwnedProject: ${error.message}`, { cause: error });
  return data && toProject(data);
}
