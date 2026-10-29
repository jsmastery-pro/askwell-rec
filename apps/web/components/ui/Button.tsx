import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-fg text-surface hover:bg-fg/85",
  secondary: "border border-line bg-glass text-fg backdrop-blur-glass hover:bg-fg/10",
  ghost: "text-fg hover:bg-fg/10",
};

type ButtonOwnProps = { variant?: ButtonVariant };

type ButtonAsButton = ButtonOwnProps &
  Omit<ComponentPropsWithoutRef<"button">, "href"> & { href?: undefined };

type ButtonAsLink = ButtonOwnProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const { variant = "primary", className, ...rest } = props;
  const classes = cn(base, variants[variant], className);

  if (rest.href !== undefined) {
    return <Link className={classes} {...(rest as ButtonAsLink)} />;
  }

  const { type = "button", ...buttonProps } = rest as ButtonAsButton;
  return <button type={type} className={classes} {...buttonProps} />;
}
