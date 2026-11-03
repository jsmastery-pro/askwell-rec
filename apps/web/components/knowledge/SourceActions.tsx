"use client";

import type { KnowledgeSource } from "@askwell/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ApiFailure } from "../projects/api";
import { Button } from "../ui";
import { deleteKnowledgeSource } from "./api";
import { deleteErrorText } from "./messages";

/** Delete for one source. Needs a second, explicit click. */
export function SourceActions({ source }: { source: Pick<KnowledgeSource, "id" | "title"> }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const pending = submitting || refreshing;

  async function remove() {
    setSubmitting(true);
    const result = await deleteKnowledgeSource(source.id);
    setSubmitting(false);
    if (!result.ok) return setFailure(result);
    startRefresh(() => router.refresh());
  }

  function open(next: boolean) {
    setFailure(null);
    setConfirming(next);
  }

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => open(true)} className="shrink-0">
        Delete
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto" role="group" aria-label="Confirm delete">
      <p className="text-sm">
        Delete <strong className="break-words">{source.title}</strong>? The bot stops using it. This
        can&apos;t be undone.
      </p>
      <div className="flex gap-2">
        <Button
          onClick={remove}
          disabled={pending}
          className="bg-danger-fg text-white hover:bg-danger-fg/85"
        >
          {pending ? "Deleting…" : "Delete source"}
        </Button>
        <Button variant="ghost" onClick={() => open(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
      {failure ? (
        <p role="alert" className="text-sm text-danger-fg">
          {deleteErrorText(failure)}
        </p>
      ) : null}
    </div>
  );
}
