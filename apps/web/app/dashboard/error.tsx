"use client";

import { useEffect } from "react";
import { Button, ErrorState } from "../../components/ui";

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      text="We could not load this page. Try again."
      action={<Button onClick={() => retry()}>Try again</Button>}
    />
  );
}
