"use client";

import { useEffect, useState } from "react";
import { Button, GlassPanel } from "../ui";

type CopyState = "idle" | "copied" | "failed";

const FEEDBACK: Record<CopyState, string> = {
  idle: "",
  copied: "Copied",
  failed: "Copy failed. Select the text and copy it.",
};

/** The snippet as text (never HTML), with a Copy button. Wraps, so nothing scrolls at 375 px. */
export function CopySnippet({ snippet }: { snippet: string }) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <GlassPanel className="flex flex-col gap-3 p-4">
      <pre className="whitespace-pre-wrap break-all rounded-md bg-surface-raised p-3 font-mono text-sm">
        <code>{snippet}</code>
      </pre>
      <div className="flex items-center gap-3">
        <Button onClick={copy}>Copy</Button>
        <p aria-live="polite" className="text-sm text-fg-muted">
          {FEEDBACK[state]}
        </p>
      </div>
    </GlassPanel>
  );
}
