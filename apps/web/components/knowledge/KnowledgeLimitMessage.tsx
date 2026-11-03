import type { Plan } from "@askwell/shared";
import { Button } from "../ui";
import { knowledgeLimitText } from "./messages";

export function KnowledgeLimitMessage({ plan }: { plan: Plan }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-md border border-line bg-surface-raised p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p>{knowledgeLimitText(plan)}</p>
      {plan === "free" ? (
        <Button href="/dashboard/billing" className="shrink-0">
          Upgrade
        </Button>
      ) : null}
    </div>
  );
}
