import { IdParamsSchema } from "@askwell/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectTabs } from "../../../../../components/projects";
import { getOwnedProject } from "../../../../../lib/projects";

export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/dashboard/projects/[id]">) {
  const parsed = IdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  // RLS: someone else's project reads as null, the same as a missing one.
  const project = await getOwnedProject(parsed.data.id);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard"
          className="text-sm text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          ← All projects
        </Link>
        <h1 className="break-words text-2xl font-semibold tracking-tight">{project.name}</h1>
      </div>
      <ProjectTabs projectId={project.id} />
      {children}
    </div>
  );
}
