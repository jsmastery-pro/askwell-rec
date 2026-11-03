import type { KnowledgeSource } from "@askwell/shared";
import { formatCreatedDate } from "../projects/messages";
import { GlassPanel } from "../ui";
import { cn } from "../ui/cn";
import { statusLabel, typeLabel } from "./messages";
import { SourceActions } from "./SourceActions";
import { isProcessing } from "./sources";

function StatusBadge({ status }: { status: KnowledgeSource["status"] }) {
  const processing = isProcessing({ status });
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs font-medium",
        status === "failed" ? "border-danger-fg text-danger-fg" : "border-line",
        status === "ready" && "bg-fg text-surface",
      )}
    >
      {processing ? (
        <span
          aria-hidden="true"
          className="size-3 animate-spin rounded-full border-2 border-line border-t-fg motion-reduce:animate-none"
        />
      ) : null}
      {statusLabel(status)}
    </span>
  );
}

export function SourceList({ sources }: { sources: readonly KnowledgeSource[] }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Knowledge sources">
      {sources.map((source) => (
        <li key={source.id}>
          <GlassPanel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate font-semibold" title={source.title}>
                  {source.title}
                </p>
                <StatusBadge status={source.status} />
              </div>
              <p className="text-sm text-fg-muted">
                {typeLabel(source.type)} · Added{" "}
                <time dateTime={source.createdAt}>{formatCreatedDate(source.createdAt)}</time>
              </p>
              {source.status === "failed" ? (
                <p className="text-sm text-danger-fg">
                  This source couldn&apos;t be processed. Delete it and add it again.
                </p>
              ) : null}
            </div>
            <SourceActions source={source} />
          </GlassPanel>
        </li>
      ))}
    </ul>
  );
}
