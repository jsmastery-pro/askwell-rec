import {
  CreateProjectRequestSchema,
  ListProjectsRequestSchema,
  PLAN_LIMITS,
  type CreateProjectResponse,
  type ListProjectsResponse,
  type Plan,
} from "@askwell/shared";
import { NextResponse, type NextRequest } from "next/server";
import { PROJECT_COLUMNS, toProject } from "../../../lib/projects";
import {
  errorResponse,
  internalError,
  invalidInput,
  readJson,
  requireUserId,
} from "../../../lib/projects/http";
import { createOwnerClient } from "../../../lib/supabase/owner";
import { createServiceClient } from "../../../lib/supabase/service";

// Projects allowed per plan. create_project reads the owner's plan itself.
const PROJECT_LIMITS = {
  free: PLAN_LIMITS.free.projects,
  pro: PLAN_LIMITS.pro.projects,
} satisfies Record<Plan, number>;

export async function GET(request: NextRequest) {
  const { response } = await requireUserId();
  if (response) return response;

  const parsed = ListProjectsRequestSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) return invalidInput();

  // RLS scopes this to the owner's projects.
  const { data, error } = await createOwnerClient()
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);

  const body: ListProjectsResponse = { projects: data.map(toProject) };
  return NextResponse.json(body);
}

export async function POST(request: NextRequest) {
  const { userId, response } = await requireUserId();
  if (response) return response;

  const parsed = CreateProjectRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidInput("Project name must be 1–80 characters.");

  // Owners can't insert (§7): create_project checks the plan limit under a row lock.
  const { data, error } = await createServiceClient().rpc("create_project", {
    p_owner_id: userId,
    p_name: parsed.data.name,
    p_project_limits: PROJECT_LIMITS,
  });
  if (error?.code === "P0001" && error.message === "limit_reached") {
    return errorResponse("limit_reached", "Your plan's project limit is reached.");
  }
  if (error) return internalError(error);

  const body: CreateProjectResponse = { project: toProject(data) };
  return NextResponse.json(body, { status: 201 });
}
