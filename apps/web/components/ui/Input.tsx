import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

export type InputProps = ComponentPropsWithoutRef<"input"> & { invalid?: boolean };

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-10 w-full rounded-md border bg-glass px-3 text-sm text-fg backdrop-blur-glass placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50",
        invalid ? "border-danger-fg" : "border-line",
        className,
      )}
      {...props}
    />
  );
}
