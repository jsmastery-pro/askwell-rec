import {
  CreateKnowledgeTextRequestSchema,
  IdParamsSchema,
  PLAN_LIMITS,
  PlanSchema,
  type CreateKnowledgeTextResponse,
  type Project,
} from "@askwell/shared";
import { after, NextResponse, type NextRequest } from "next/server";
import { toKnowledgeSource } from "../../../../../components/knowledge/sources";
import { processSource } from "../../../../../lib/knowledge";
import { getOwnedProject } from "../../../../../lib/projects";
import {
  errorResponse,
  internalError,
  invalidInput,
  projectNotFound,
  readJson,
  requireUserId,
} from "../../../../../lib/projects/http";
import { createOwnerClient } from "../../../../../lib/supabase/owner";
import { createServiceClient } from "../../../../../lib/supabase/service";

// RLS returns only the signed-in owner's row.
const readPlan = () => createOwnerClient().from("accounts").select("plan").maybeSingle();

// Paste text: reserve a source (counts toward the plan's limit), answer `processing` right
// away, then chunk and embed it after the response.
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/knowledge">,
) {
  const { response } = await requireUserId();
  if (response) return response;

  const params = IdParamsSchema.safeParse(await ctx.params);
  if (!params.success) return invalidInput("Invalid project id.");
  const parsed = CreateKnowledgeTextRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidInput("Enter a title and some text.");
  const { title, content } = parsed.data;

  // Owner client (RLS): another owner's project reads as null, the same as a missing one.
  let project: Project | null;
  let account: Awaited<ReturnType<typeof readPlan>>;
  try {
    [project, account] = await Promise.all([getOwnedProject(params.data.id), readPlan()]);
  } catch (error) {
    return internalError(error);
  }
  if (!project) return projectNotFound();
  if (account.error) return internalError(account.error);
  // The plan comes from the database, never the request.
  const plan = PlanSchema.catch("free").parse(account.data?.plan);

  // Service client only now that ownership is checked. The row lock inside makes the limit hold
  // under parallel requests.
  const { data, error } = await createServiceClient().rpc("reserve_knowledge_source", {
    p_project_id: project.id,
    p_title: title,
    p_type: "text",
    // Pasted text has no file. The generated type says string; the column and function take null.
    p_storage_key: null as unknown as string,
    p_status: "processing",
    p_limit: PLAN_LIMITS[plan].knowledgeSourcesPerProject,
  });
  if (error?.code === "P0001" && error.message === "limit_reached") {
    return errorResponse("limit_reached", "Your plan's knowledge source limit is reached.");
  }
  if (error) return internalError(error);

  // The title goes in too, so a question that names it finds the text.
  after(() => processSource(data.id, project.id, `# ${title}\n\n${content}`));

  const body: CreateKnowledgeTextResponse = { source: toKnowledgeSource(data) };
  return NextResponse.json(body);
}
