import { APP_NAME } from "@askwell/shared";
import { GlassPanel } from "../ui";
import { Section } from "./Section";

// Static mock of the widget panel. The real widget runs here in Phase 6 (project.md §6.1).
export function LiveDemo() {
  return (
    <Section
      id="demo"
      title="See it in action"
      intro="A visitor asks, the bot answers from your documents."
    >
      <figure aria-label="Example conversation" className="motion-scroll-in mx-auto max-w-md">
        <GlassPanel className="overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-sm font-medium">{APP_NAME}</div>
          <div className="flex flex-col gap-3 p-4 text-sm">
            <p className="max-w-[85%] self-end rounded-lg bg-fg px-3 py-2 text-surface">
              Can I use it on more than one site?
            </p>
            <p className="max-w-[85%] self-start rounded-lg border border-line bg-glass px-3 py-2">
              Yes. Each project has its own key and its own knowledge, so you can add one script tag
              per site.
            </p>
          </div>
          <div className="border-t border-line p-3">
            <div className="rounded-md border border-line px-3 py-2 text-sm text-fg-muted">
              Ask a question
            </div>
          </div>
        </GlassPanel>
        <figcaption className="mt-3 text-center text-xs text-fg-muted">Example only</figcaption>
      </figure>
    </Section>
  );
}
