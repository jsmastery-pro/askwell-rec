import { PlanSchema } from "@askwell/shared";
import { NewProjectForm, ProjectList } from "../../../components/projects";
import { EmptyState, GlassPanel } from "../../../components/ui";
import { PROJECT_COLUMNS, toProject } from "../../../lib/projects";
import { createOwnerClient } from "../../../lib/supabase/owner";

export default async function ProjectsPage() {
  // Owner client: RLS scopes both reads to the signed-in owner. No manual owner filter.
  const owner = createOwnerClient();
  const [projectsResult, accountResult] = await Promise.all([
    owner.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: false }),
    owner.from("accounts").select("plan").maybeSingle(),
  ]);
  if (projectsResult.error) {
    throw new Error(`ProjectsPage: ${projectsResult.error.message}`, {
      cause: projectsResult.error,
    });
  }
  if (accountResult.error) {
    throw new Error(`ProjectsPage: ${accountResult.error.message}`, {
      cause: accountResult.error,
    });
  }

  const projects = projectsResult.data.map(toProject);
  // Only picks the limit message's wording; the server enforces the limit on create.
  const plan = PlanSchema.catch("free").parse(accountResult.data?.plan);

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Projects</h1>
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          text="A project is one website with its own knowledge and chat widget."
          action={<NewProjectForm plan={plan} />}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <GlassPanel className="p-4">
            <NewProjectForm plan={plan} />
          </GlassPanel>
          <ProjectList projects={projects} />
        </div>
      )}
    </>
  );
}
