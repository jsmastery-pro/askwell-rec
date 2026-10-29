import { GlassPanel } from "../ui";
import { Section } from "./Section";

// Static example. The real snippet format is set in Phase 2.
export const SNIPPET = `<script src="https://example.com/widget.js" data-key="YOUR_PUBLIC_KEY" async></script>`;

export function InstallSnippet() {
  return (
    <Section
      id="install"
      title="One tag to install"
      intro="Paste it before the closing body tag on any page."
    >
      <GlassPanel className="motion-scroll-in p-4 sm:p-6">
        <pre className="overflow-x-auto text-sm">
          <code>{SNIPPET}</code>
        </pre>
      </GlassPanel>
    </Section>
  );
}
