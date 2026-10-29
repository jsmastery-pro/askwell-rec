import type { ReactNode } from "react";
import { cn } from "./cn";
import { GlassPanel } from "./GlassPanel";

type StateProps = {
  title: string;
  text?: string;
  action?: ReactNode;
  className?: string;
};

function StateBody({
  title,
  text,
  action,
  className,
  children,
}: StateProps & { children?: ReactNode }) {
  return (
    <GlassPanel
      className={cn("flex flex-col items-center gap-3 p-6 text-center sm:p-10", className)}
    >
      {children}
      <h2 className="text-base font-semibold">{title}</h2>
      {text ? <p className="max-w-sm text-sm text-fg-muted">{text}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </GlassPanel>
  );
}

export function EmptyState(props: StateProps) {
  return <StateBody {...props} />;
}

export function LoadingState(props: StateProps) {
  return (
    <div role="status" aria-live="polite">
      <StateBody {...props}>
        <span
          aria-hidden="true"
          className="size-6 animate-spin rounded-full border-2 border-line border-t-fg motion-reduce:animate-none"
        />
      </StateBody>
    </div>
  );
}

export function ErrorState(props: StateProps) {
  return (
    <div role="alert">
      <StateBody {...props} />
    </div>
  );
}
