import { IdParamsSchema } from "@askwell/shared";
import { notFound } from "next/navigation";
import { CopySnippet } from "../../../../../../components/install/CopySnippet";
import { getAppUrl } from "../../../../../../lib/app-url";
import { buildInstallSnippet } from "../../../../../../lib/install-snippet";
import { getOwnedProject } from "../../../../../../lib/projects";

const STEPS = [
  "Copy the tag below.",
  "Paste it on your site, just before the closing </body> tag.",
  "Reload your site. The chat button appears in the corner.",
];

export default async function InstallPage({
  params,
}: PageProps<"/dashboard/projects/[id]/install">) {
  const parsed = IdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  // RLS: someone else's project reads as null, the same as a missing one.
  const project = await getOwnedProject(parsed.data.id);
  if (!project) notFound();

  const snippet = buildInstallSnippet(getAppUrl(), project.publicKey);

  return (
    <section aria-labelledby="install-heading" className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id="install-heading" className="text-lg font-semibold">
          Install the widget
        </h2>
        <p className="text-sm text-fg-muted">
          Add one tag to your site. The key in it only identifies this project, so it is safe to put
          in public HTML.
        </p>
      </div>
      <ol className="flex flex-col gap-2 text-sm">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fg text-xs font-semibold text-surface"
            >
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <CopySnippet snippet={snippet} />
    </section>
  );
}
