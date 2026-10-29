import type { ReactNode } from "react";
import { cn } from "../ui/cn";

type SectionProps = {
  id: string;
  title: string;
  intro?: string;
  className?: string;
  children: ReactNode;
};

export function Section({ id, title, intro, className, children }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-24", className)}
    >
      <div className="motion-scroll-in mb-10 max-w-2xl">
        <h2 id={`${id}-title`} className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {intro ? <p className="mt-3 text-fg-muted">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}
