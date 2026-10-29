import { PLANS, PLAN_LIMITS, PLAN_PRICES, type Plan } from "@askwell/shared";
import { Button, GlassPanel } from "../ui";
import { Section } from "./Section";

const PLAN_TITLES: Record<Plan, string> = { free: "Free", pro: "Pro" };

const CUSTOMIZATION_LABELS = {
  buttonColor: "Button color",
  position: "Button position",
  label: "Button label",
  animation: "Open animation",
  headerText: "Header text",
  hideBadge: "Hide the “Powered by” badge",
} as const;

const number = new Intl.NumberFormat("en-US");

function count(n: number, one: string, many: string): string {
  return `${number.format(n)} ${n === 1 ? one : many}`;
}

// Plans without an entry in PLAN_PRICES are free.
export function priceOf(plan: Plan): number {
  return plan === "pro" ? PLAN_PRICES.pro.monthlyUsd : 0;
}

export function Pricing() {
  return (
    <Section id="pricing" title="Pricing" intro="Start free. Upgrade when you need more.">
      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((plan) => {
          const limits = PLAN_LIMITS[plan];
          const customizations = (
            Object.keys(CUSTOMIZATION_LABELS) as Array<keyof typeof CUSTOMIZATION_LABELS>
          ).filter((key) => limits.customization[key]);

          return (
            <GlassPanel key={plan} data-plan={plan} className="motion-scroll-in flex flex-col p-6">
              <h3 className="text-lg font-semibold">{PLAN_TITLES[plan]}</h3>
              <p className="mt-2">
                <span className="text-4xl font-semibold tracking-tight">${priceOf(plan)}</span>
                <span className="text-sm text-fg-muted"> / month</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                <li>{count(limits.projects, "project", "projects")}</li>
                <li>
                  {number.format(limits.messagesPerMonthPerProject)} messages / month per project
                </li>
                <li>
                  {number.format(limits.knowledgeSourcesPerProject)} knowledge sources per project
                </li>
                {customizations.length > 0 ? (
                  <li>
                    Customize: {customizations.map((key) => CUSTOMIZATION_LABELS[key]).join(", ")}
                  </li>
                ) : (
                  <li className="text-fg-muted">Default widget look</li>
                )}
              </ul>
              <Button
                href="/sign-up"
                variant={plan === "pro" ? "primary" : "secondary"}
                className="mt-6"
              >
                {plan === "pro" ? "Start free, upgrade later" : "Start free"}
              </Button>
            </GlassPanel>
          );
        })}
      </div>
    </Section>
  );
}
