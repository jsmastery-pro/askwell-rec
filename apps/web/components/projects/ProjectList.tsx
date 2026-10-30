import type { Project } from "@askwell/shared";
import Link from "next/link";
import { GlassPanel } from "../ui";
import { formatCreatedDate } from "./messages";
import { ProjectActions } from "./ProjectActions";

export const projectHref = (id: string) => `/dashboard/projects/${id}`;

export function ProjectList({ projects }: { projects: readonly Project[] }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Your projects">
      {projects.map((project) => (
        <li key={project.id}>
          <GlassPanel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link
                href={projectHref(project.id)}
                className="block truncate font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {project.name}
              </Link>
              <p className="text-sm text-fg-muted">
                Created{" "}
                <time dateTime={project.createdAt}>{formatCreatedDate(project.createdAt)}</time>
              </p>
            </div>
            <ProjectActions project={project} />
          </GlassPanel>
        </li>
      ))}
    </ul>
  );
}
