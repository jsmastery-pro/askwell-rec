"use client";

import { CreateProjectResponseSchema, PROJECT_NAME_MAX_LENGTH, type Plan } from "@askwell/shared";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { Button, Input } from "../ui";
import { sendJson, type ApiFailure } from "./api";
import { LimitReachedMessage } from "./LimitReachedMessage";
import { projectErrorText } from "./messages";

/** `plan` only picks the limit message's wording. The server enforces the limit. */
export function NewProjectForm({ plan }: { plan: Plan }) {
  const router = useRouter();
  const inputId = useId();
  const [name, setName] = useState("");
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const pending = submitting || refreshing;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFailure(null);
    const result = await sendJson("/api/projects", "POST", CreateProjectResponseSchema, { name });
    setSubmitting(false);
    if (!result.ok) {
      setFailure(result);
      return;
    }
    setName("");
    startRefresh(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3 text-left">
      <label htmlFor={inputId} className="text-sm font-medium">
        Project name
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="My website"
          maxLength={PROJECT_NAME_MAX_LENGTH}
          required
          invalid={failure?.code === "invalid_input"}
          disabled={pending}
        />
        <Button type="submit" disabled={pending || name.trim() === ""} className="shrink-0">
          {pending ? "Creating…" : "New project"}
        </Button>
      </div>
      {failure?.code === "limit_reached" ? (
        <LimitReachedMessage plan={plan} />
      ) : failure ? (
        <p role="alert" className="text-sm text-danger-fg">
          {projectErrorText(failure)}
        </p>
      ) : null}
    </form>
  );
}
