"use client";

import { KNOWLEDGE_FILE_MIME_TYPES, KNOWLEDGE_FILE_TYPES, type Plan } from "@askwell/shared";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ChangeEvent } from "react";
import { cn } from "../ui/cn";
import { checkKnowledgeFile, uploadKnowledgeFile, type UploadStage } from "./api";
import { KnowledgeLimitMessage } from "./KnowledgeLimitMessage";
import { fileCheckText, MAX_FILE_SIZE_TEXT, uploadErrorText } from "./messages";

const ACCEPT = [
  ...KNOWLEDGE_FILE_TYPES.map((type) => `.${type}`),
  ...Object.values(KNOWLEDGE_FILE_MIME_TYPES),
].join(",");

type Progress = { name: string; stage: UploadStage; fraction?: number };
type Problem = { kind: "limit" } | { kind: "error"; text: string };

function progressText({ name, stage, fraction }: Progress) {
  if (stage === "reserve") return `Preparing ${name}…`;
  if (stage === "finalize") return `Checking ${name}…`;
  return `Uploading ${name}… ${Math.round((fraction ?? 0) * 100)}%`;
}

/**
 * Pick a PDF, Markdown or TXT file; it uploads straight away. Type and size are checked here
 * for fast feedback; `plan` only picks the limit message's wording. The server decides.
 */
export function UploadFileForm({ projectId, plan }: { projectId: string; plan: Plan }) {
  const router = useRouter();
  const inputId = useId();
  const hintId = useId();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const busy = progress !== null || refreshing;

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear it, so picking the same file again still fires a change.
    event.target.value = "";
    if (!file) return;

    setProblem(null);
    const check = checkKnowledgeFile(file);
    if (!check.ok) return setProblem({ kind: "error", text: fileCheckText(file, check.reason) });

    setProgress({ name: file.name, stage: "reserve" });
    const result = await uploadKnowledgeFile(projectId, file, (stage, fraction) =>
      setProgress({ name: file.name, stage, fraction }),
    );
    setProgress(null);
    if (!result.ok) {
      setProblem(
        result.code === "limit_reached"
          ? { kind: "limit" }
          : { kind: "error", text: uploadErrorText(result) },
      );
    }
    // Even a refused file may have changed the list (a deleted reservation, a failed source).
    startRefresh(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold">Upload a file</h3>
      <p id={hintId} className="text-sm text-fg-muted">
        PDF, Markdown or TXT, up to {MAX_FILE_SIZE_TEXT}.
      </p>
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex min-h-10 cursor-pointer items-center justify-center self-start rounded-md bg-fg px-4 text-sm font-medium text-surface transition-colors hover:bg-fg/85 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
          busy && "pointer-events-none opacity-50",
        )}
      >
        {busy ? "Uploading…" : "Choose file"}
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          onChange={onChange}
          disabled={busy}
          aria-describedby={hintId}
          className="sr-only"
        />
      </label>
      {progress ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5 text-sm">
          <span className="break-words">{progressText(progress)}</span>
          <progress
            value={progress.stage === "upload" ? (progress.fraction ?? 0) : undefined}
            max={1}
            aria-label="Upload progress"
            className="h-1.5 w-full overflow-hidden rounded-full accent-fg"
          />
        </div>
      ) : null}
      {problem?.kind === "limit" ? (
        <KnowledgeLimitMessage plan={plan} />
      ) : problem ? (
        <p role="alert" className="break-words text-sm text-danger-fg">
          {problem.text}
        </p>
      ) : null}
    </div>
  );
}
