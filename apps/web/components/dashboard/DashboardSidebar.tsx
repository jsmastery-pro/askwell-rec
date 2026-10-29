"use client";

import { UserButton } from "@clerk/nextjs";
import { APP_NAME } from "@askwell/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui/cn";
import { DASHBOARD_NAV, isNavActive } from "./nav";

/**
 * Glass sidebar from 768 px up. Below that it is a top bar: the mark and the user button on
 * the first row, the nav links on the second. No drawer, so nothing hides at 375 px.
 */
export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 border-b border-line bg-glass px-4 py-3 backdrop-blur-glass md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:items-stretch md:gap-6 md:border-b-0 md:border-r md:p-6">
      <p className="text-lg font-semibold tracking-tight">{APP_NAME}</p>
      <nav
        aria-label="Dashboard"
        className="col-span-2 order-last flex gap-1 md:order-none md:flex-col"
      >
        {DASHBOARD_NAV.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                active ? "bg-fg text-surface" : "text-fg-muted hover:bg-fg/10 hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center md:order-last md:mt-auto">
        <UserButton />
      </div>
    </aside>
  );
}
