import {
  IdParamsSchema,
  UpdateProjectRequestSchema,
  type DeleteProjectResponse,
  type UpdateProjectResponse,
} from "@askwell/shared";
import { NextResponse, type NextRequest } from "next/server";
import { PROJECT_COLUMNS, toProject } from "../../../../lib/projects";
import {
  internalError,
  invalidInput,
  projectNotFound,
  readJson,
  requireUserId,
} from "../../../../lib/projects/http";
import { createOwnerClient } from "../../../../lib/supabase/owner";

// Both go through the owner client: RLS limits them to the owner's projects, so another
// owner's project looks the same as a missing one (404).

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  const { response } = await requireUserId();
  if (response) return response;

  const params = IdParamsSchema.safeParse(await ctx.params);
  if (!params.success) return invalidInput("Invalid project id.");
  const parsed = UpdateProjectRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidInput("Project name must be 1–80 characters.");

  // The `name` column grant means only the name can change.
  const { data, error } = await createOwnerClient()
    .from("projects")
    .update({ name: parsed.data.name })
    .eq("id", params.data.id)
    .select(PROJECT_COLUMNS)
    .maybeSingle();
  if (error) return internalError(error);
  if (!data) return projectNotFound();

  const body: UpdateProjectResponse = { project: toProject(data) };
  return NextResponse.json(body);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  const { response } = await requireUserId();
  if (response) return response;

  const params = IdParamsSchema.safeParse(await ctx.params);
  if (!params.success) return invalidInput("Invalid project id.");

  // Cascades to the widget config, knowledge, conversations and messages.
  const { data, error } = await createOwnerClient()
    .from("projects")
    .delete()
    .eq("id", params.data.id)
    .select("id")
    .maybeSingle();
  if (error) return internalError(error);
  if (!data) return projectNotFound();

  const body: DeleteProjectResponse = { id: data.id };
  return NextResponse.json(body);
}
