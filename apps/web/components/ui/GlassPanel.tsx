import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

export function GlassPanel({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-glass text-fg shadow-glass backdrop-blur-glass",
        className,
      )}
      {...props}
    />
  );
}
