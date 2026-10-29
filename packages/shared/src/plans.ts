import { z } from "zod";

export const PLANS = ["free", "pro"] as const;
export const PlanSchema = z.enum(PLANS);
export type Plan = z.infer<typeof PlanSchema>;

/** What a plan may change in the widget. `false` means the default is forced. */
export type CustomizationRights = {
  buttonColor: boolean;
  position: boolean;
  label: boolean;
  animation: boolean;
  headerText: boolean;
  hideBadge: boolean;
};

export type PlanLimits = {
  projects: number;
  messagesPerMonthPerProject: number;
  knowledgeSourcesPerProject: number;
  customization: CustomizationRights;
};

// project.md §5. The only place plan limits live.
export const PLAN_LIMITS = {
  free: {
    projects: 1,
    messagesPerMonthPerProject: 100,
    knowledgeSourcesPerProject: 3,
    customization: {
      buttonColor: false,
      position: false,
      label: false,
      animation: false,
      headerText: false,
      hideBadge: false,
    },
  },
  pro: {
    projects: 5,
    messagesPerMonthPerProject: 2_000,
    knowledgeSourcesPerProject: 25,
    customization: {
      buttonColor: true,
      position: true,
      label: true,
      animation: true,
      headerText: true,
      hideBadge: true,
    },
  },
} as const satisfies Record<Plan, PlanLimits>;

export const PLAN_PRICES = {
  pro: { monthlyUsd: 19 },
} as const satisfies Partial<Record<Plan, { monthlyUsd: number }>>;
