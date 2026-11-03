import {
  KNOWLEDGE_TEXT_MAX_LENGTH,
  KNOWLEDGE_TITLE_MAX_LENGTH,
  MAX_KNOWLEDGE_FILE_BYTES,
  PLAN_LIMITS,
  type KnowledgeSourceStatus,
  type KnowledgeSourceType,
  type Plan,
} from "@askwell/shared";
import type { ApiFailure } from "../projects/api";
import type { FileCheck, UploadFailure } from "./api";

const sources = (n: number) => `${n} source${n === 1 ? "" : "s"}`;
const megabytes = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

export const MAX_FILE_SIZE_TEXT = megabytes(MAX_KNOWLEDGE_FILE_BYTES);

/** Shown at the source limit. Numbers come from PLAN_LIMITS. */
export function knowledgeLimitText(plan: Plan): string {
  const { free, pro } = PLAN_LIMITS;
  if (plan === "free") {
    return `The Free plan allows ${sources(free.knowledgeSourcesPerProject)} per project. Upgrade to Pro for up to ${sources(pro.knowledgeSourcesPerProject)}.`;
  }
  return `The Pro plan allows ${sources(pro.knowledgeSourcesPerProject)} per project. Delete one to add another.`;
}

export function sourcesUsedText(used: number, limit: number): string {
  return `${used} of ${sources(limit)} used`;
}

/** `uploading` shows as Processing: to the owner it's one step. */
export function statusLabel(status: KnowledgeSourceStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return "Processing";
  }
}

const TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  text: "Pasted text",
  pdf: "PDF",
  md: "Markdown",
  txt: "Text file",
};

export const typeLabel = (type: KnowledgeSourceType) => TYPE_LABELS[type];

/** The browser's check of a picked file. */
export function fileCheckText(
  file: Pick<File, "name" | "size">,
  reason: (FileCheck & { ok: false })["reason"],
): string {
  if (reason === "type")
    return `${file.name} can't be added. Use a PDF, Markdown (.md) or TXT file.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return `${file.name} is ${megabytes(file.size)}. Files can be up to ${MAX_FILE_SIZE_TEXT}.`;
}

/** Text for a failed paste. `limit_reached` shows the limit message instead. */
export function textErrorText(failure: ApiFailure): string {
  if (failure.code === "invalid_input") {
    return `Enter a title (up to ${KNOWLEDGE_TITLE_MAX_LENGTH} characters) and text (up to ${KNOWLEDGE_TEXT_MAX_LENGTH.toLocaleString("en-US")} characters).`;
  }
  return commonErrorText(failure);
}

/** Text for a failed upload. `limit_reached` shows the limit message instead. */
export function uploadErrorText(failure: UploadFailure): string {
  if (failure.stage === "upload")
    return "The upload didn't finish. Check your connection and try again.";
  if (failure.code === "invalid_input") {
    return failure.stage === "finalize"
      ? "The file was refused: it doesn't match its type or is over the size limit."
      : `Use a PDF, Markdown or TXT file up to ${MAX_FILE_SIZE_TEXT}.`;
  }
  return commonErrorText(failure);
}

/** Text for a failed delete. */
export function deleteErrorText(failure: ApiFailure): string {
  if (failure.code === "not_found") return "This source no longer exists. Reload the page.";
  return commonErrorText(failure);
}

function commonErrorText(failure: ApiFailure): string {
  switch (failure.code) {
    case "unauthorized":
      return "Your session ended. Sign in again.";
    case "not_found":
      return "This project no longer exists. Reload the page.";
    case "rate_limited":
      return "Too many requests. Wait a moment and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}
