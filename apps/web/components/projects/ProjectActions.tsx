"use client";

import {
  DeleteProjectResponseSchema,
  PROJECT_NAME_MAX_LENGTH,
  UpdateProjectResponseSchema,
  type Project,
} from "@askwell/shared";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { Button, Input } from "../ui";
import { sendJson, type ApiFailure } from "./api";
import { projectErrorText } from "./messages";

type Mode = "idle" | "rename" | "delete";

/** Rename and delete for one project card. Delete needs a second, explicit click. */
export function ProjectActions({ project }: { project: Pick<Project, "id" | "name"> }) {
  const router = useRouter();
  const inputId = useId();
  const [mode, setMode] = useState<Mode>("idle");
  const [name, setName] = useState(project.name);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const pending = submitting || refreshing;
  const url = `/api/projects/${project.id}`;

  function open(next: Mode) {
    setFailure(null);
    setName(project.name);
    setMode(next);
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const result = await sendJson(url, "PATCH", UpdateProjectResponseSchema, { name });
    setSubmitting(false);
    if (!result.ok) return setFailure(result);
    setMode("idle");
    startRefresh(() => router.refresh());
  }

  async function remove() {
    setSubmitting(true);
    const result = await sendJson(url, "DELETE", DeleteProjectResponseSchema);
    setSubmitting(false);
    if (!result.ok) return setFailure(result);
    startRefresh(() => router.refresh());
  }

  const error = failure ? (
    <p role="alert" className="text-sm text-danger-fg">
      {projectErrorText(failure)}
    </p>
  ) : null;

  if (mode === "rename") {
    return (
      <form onSubmit={rename} className="flex w-full flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">
          New name for {project.name}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={inputId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={PROJECT_NAME_MAX_LENGTH}
            required
            autoFocus
            invalid={failure?.code === "invalid_input"}
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || name.trim() === ""}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => open("idle")} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
        {error}
      </form>
    );
  }

  if (mode === "delete") {
    return (
      <div className="flex w-full flex-col gap-2" role="group" aria-label="Confirm delete">
        <p className="text-sm">
          Delete <strong className="break-words">{project.name}</strong>? Its knowledge,
          conversations and widget settings are deleted too. This can&apos;t be undone.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={remove}
            disabled={pending}
            className="bg-danger-fg text-white hover:bg-danger-fg/85"
          >
            {pending ? "Deleting…" : "Delete project"}
          </Button>
          <Button variant="ghost" onClick={() => open("idle")} disabled={pending}>
            Cancel
          </Button>
        </div>
        {error}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => open("rename")}>
        Rename
      </Button>
      <Button variant="secondary" onClick={() => open("delete")}>
        Delete
      </Button>
    </div>
  );
}
