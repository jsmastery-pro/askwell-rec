"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui/cn";

type Tab = { label: string; segment: string; ready: boolean };

// Later phases switch these on.
export const PROJECT_TABS: readonly Tab[] = [
  { label: "Install", segment: "install", ready: true },
  { label: "Knowledge", segment: "knowledge", ready: false },
  { label: "Conversations", segment: "conversations", ready: false },
  { label: "Customize", segment: "customize", ready: false },
];

const tabClass =
  "flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Wraps instead of scrolling, so every tab fits at 375 px. */
export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Project" className="flex flex-wrap gap-1 border-b border-line pb-3">
      {PROJECT_TABS.map((tab) => {
        const href = `/dashboard/projects/${projectId}/${tab.segment}`;
        if (!tab.ready) {
          return (
            <span key={tab.segment} aria-disabled="true" className={cn(tabClass, "text-fg-muted")}>
              {tab.label}
              <span className="rounded-sm border border-line px-1.5 py-0.5 text-xs">Soon</span>
            </span>
          );
        }
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              tabClass,
              "transition-colors",
              active ? "bg-fg text-surface" : "text-fg-muted hover:bg-fg/10 hover:text-fg",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
