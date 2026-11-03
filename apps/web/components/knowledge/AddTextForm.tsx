"use client";

import { KNOWLEDGE_TEXT_MAX_LENGTH, KNOWLEDGE_TITLE_MAX_LENGTH, type Plan } from "@askwell/shared";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import type { ApiFailure } from "../projects/api";
import { Button, Input } from "../ui";
import { cn } from "../ui/cn";
import { addKnowledgeText } from "./api";
import { KnowledgeLimitMessage } from "./KnowledgeLimitMessage";
import { textErrorText } from "./messages";

/** Paste text with a title. `plan` only picks the limit message's wording; the server enforces it. */
export function AddTextForm({ projectId, plan }: { projectId: string; plan: Plan }) {
  const router = useRouter();
  const titleId = useId();
  const contentId = useId();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const pending = submitting || refreshing;
  const invalid = failure?.code === "invalid_input";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFailure(null);
    const result = await addKnowledgeText(projectId, { title, content });
    setSubmitting(false);
    if (!result.ok) return setFailure(result);
    setTitle("");
    setContent("");
    startRefresh(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Paste text">
      <h3 className="text-base font-semibold">Paste text</h3>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleId} className="text-sm font-medium">
          Title
        </label>
        <Input
          id={titleId}
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Shipping policy"
          maxLength={KNOWLEDGE_TITLE_MAX_LENGTH}
          required
          invalid={invalid}
          disabled={pending}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={contentId} className="text-sm font-medium">
          Text
        </label>
        <textarea
          id={contentId}
          name="content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Paste the text visitors should get answers from."
          maxLength={KNOWLEDGE_TEXT_MAX_LENGTH}
          required
          rows={6}
          aria-invalid={invalid || undefined}
          disabled={pending}
          className={cn(
            "w-full resize-y rounded-md border bg-glass px-3 py-2 text-sm text-fg backdrop-blur-glass placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50",
            invalid ? "border-danger-fg" : "border-line",
          )}
        />
      </div>
      <Button
        type="submit"
        disabled={pending || title.trim() === "" || content.trim() === ""}
        className="self-start"
      >
        {pending ? "Adding…" : "Add text"}
      </Button>
      {failure?.code === "limit_reached" ? (
        <KnowledgeLimitMessage plan={plan} />
      ) : failure ? (
        <p role="alert" className="text-sm text-danger-fg">
          {textErrorText(failure)}
        </p>
      ) : null}
    </form>
  );
}
