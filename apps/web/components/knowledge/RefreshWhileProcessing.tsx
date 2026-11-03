"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const REFRESH_INTERVAL_MS = 3000;

/** Re-renders the server page every few seconds while `active`, so statuses update on their own. */
export function RefreshWhileProcessing({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, router]);

  return null;
}
