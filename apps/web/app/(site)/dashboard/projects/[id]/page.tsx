import { redirect } from "next/navigation";

// The layout has already checked ownership. Install is the first tab (P2P-T07).
export default async function ProjectPage({ params }: PageProps<"/dashboard/projects/[id]">) {
  const { id } = await params;
  redirect(`/dashboard/projects/${id}/install`);
}
