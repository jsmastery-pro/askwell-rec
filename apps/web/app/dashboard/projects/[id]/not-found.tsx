import { Button, EmptyState } from "../../../../components/ui";

export default function ProjectNotFound() {
  return (
    <EmptyState
      title="Project not found"
      text="It may have been deleted, or it belongs to another account."
      action={<Button href="/dashboard">All projects</Button>}
    />
  );
}
