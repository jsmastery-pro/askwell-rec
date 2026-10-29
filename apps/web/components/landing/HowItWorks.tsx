import { GlassPanel } from "../ui";
import { Section } from "./Section";

export const STEPS = [
  {
    title: "Create a project",
    text: "Name your site. You get a public key for the widget.",
  },
  {
    title: "Add knowledge",
    text: "Upload PDF, Markdown or text files, or paste text. Answers come only from these.",
  },
  {
    title: "Paste the snippet",
    text: "Add one script tag to your site. The chat button appears.",
  },
] as const;

export function HowItWorks() {
  return (
    <Section id="how-it-works" title="How it works" intro="Three steps. No code beyond one tag.">
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="motion-scroll-in">
            <GlassPanel className="h-full p-6">
              <span className="text-sm text-fg-muted">Step {index + 1}</span>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-fg-muted">{step.text}</p>
            </GlassPanel>
          </li>
        ))}
      </ol>
    </Section>
  );
}
