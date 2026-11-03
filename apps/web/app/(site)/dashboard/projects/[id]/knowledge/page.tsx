import { IdParamsSchema, PLAN_LIMITS, PlanSchema } from "@askwell/shared";
import { notFound } from "next/navigation";
import {
  AddTextForm,
  KNOWLEDGE_SOURCE_COLUMNS,
  KnowledgeLimitMessage,
  RefreshWhileProcessing,
  SourceList,
  UploadFileForm,
  isProcessing,
  notStaleUpload,
  sourcesUsedText,
  toKnowledgeSource,
} from "../../../../../../components/knowledge";
import { EmptyState, GlassPanel } from "../../../../../../components/ui";
import { getOwnedProject } from "../../../../../../lib/projects";
import { createOwnerClient } from "../../../../../../lib/supabase/owner";

export default async function KnowledgePage({
  params,
}: PageProps<"/dashboard/projects/[id]/knowledge">) {
  const parsed = IdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const projectId = parsed.data.id;

  // Owner client: RLS scopes every read to the signed-in owner. No manual owner filter.
  const owner = createOwnerClient();
  const [project, sourcesResult, accountResult] = await Promise.all([
    getOwnedProject(projectId),
    owner
      .from("knowledge_sources")
      .select(KNOWLEDGE_SOURCE_COLUMNS)
      .eq("project_id", projectId)
      .or(notStaleUpload())
      .order("created_at", { ascending: false }),
    owner.from("accounts").select("plan").maybeSingle(),
  ]);
  // Someone else's project reads as null, the same as a missing one.
  if (!project) notFound();
  if (sourcesResult.error) {
    throw new Error(`KnowledgePage: ${sourcesResult.error.message}`, {
      cause: sourcesResult.error,
    });
  }
  if (accountResult.error) {
    throw new Error(`KnowledgePage: ${accountResult.error.message}`, {
      cause: accountResult.error,
    });
  }

  const sources = sourcesResult.data.map(toKnowledgeSource);
  // Picks the limit shown here; the server enforces it on every add.
  const plan = PlanSchema.catch("free").parse(accountResult.data?.plan);
  const limit = PLAN_LIMITS[plan].knowledgeSourcesPerProject;
  const atLimit = sources.length >= limit;

  return (
    <section aria-labelledby="knowledge-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="knowledge-heading" className="text-lg font-semibold">
            Knowledge
          </h2>
          <p className="text-sm text-fg-muted">The bot answers visitors only from these sources.</p>
        </div>
        <p className="text-sm font-medium">{sourcesUsedText(sources.length, limit)}</p>
      </div>

      {atLimit ? (
        <KnowledgeLimitMessage plan={plan} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <GlassPanel className="p-4">
            <AddTextForm projectId={projectId} plan={plan} />
          </GlassPanel>
          <GlassPanel className="p-4">
            <UploadFileForm projectId={projectId} plan={plan} />
          </GlassPanel>
        </div>
      )}

      {sources.length === 0 ? (
        <EmptyState
          title="No knowledge yet"
          text="Paste text or upload a file. The bot uses it to answer your visitors."
        />
      ) : (
        <SourceList sources={sources} />
      )}

      <RefreshWhileProcessing active={sources.some(isProcessing)} />
    </section>
  );
}
