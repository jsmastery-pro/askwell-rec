import type { Plan } from "@askwell/shared";
import { Button } from "../ui";
import { projectLimitText } from "./messages";

export function LimitReachedMessage({ plan }: { plan: Plan }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-md border border-line bg-surface-raised p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p>{projectLimitText(plan)}</p>
      {plan === "free" ? (
        <Button href="/dashboard/billing" className="shrink-0">
          Upgrade
        </Button>
      ) : null}
    </div>
  );
}
