import { Button, EmptyState } from "../../components/ui";

export default function ProjectsPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Projects</h1>
      <EmptyState
        title="No projects yet"
        text="A project is one website with its own knowledge and chat widget."
        action={
          <div className="flex flex-col items-center gap-2">
            <Button disabled>New project</Button>
            <p className="text-xs text-fg-muted">Creating projects comes in Phase 2.</p>
          </div>
        }
      />
    </>
  );
}
