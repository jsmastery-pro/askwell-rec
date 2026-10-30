import { PLAN_LIMITS, PROJECT_NAME_MAX_LENGTH, type Plan } from "@askwell/shared";
import type { ApiFailure } from "./api";

const projects = (n: number) => `${n} project${n === 1 ? "" : "s"}`;

/** Shown when create_project refuses with `limit_reached`. Numbers come from PLAN_LIMITS. */
export function projectLimitText(plan: Plan): string {
  if (plan === "free") {
    return `The Free plan allows ${projects(PLAN_LIMITS.free.projects)}. Upgrade to Pro for up to ${projects(PLAN_LIMITS.pro.projects)}.`;
  }
  return `The Pro plan allows ${projects(PLAN_LIMITS.pro.projects)}. Delete one to create another.`;
}

/** Text for any other failed project request. */
export function projectErrorText(failure: ApiFailure): string {
  switch (failure.code) {
    case "invalid_input":
      return `Enter a name of 1 to ${PROJECT_NAME_MAX_LENGTH} characters.`;
    case "unauthorized":
      return "Your session ended. Sign in again.";
    case "not_found":
      return "This project no longer exists. Reload the page.";
    default:
      return "Something went wrong. Try again.";
  }
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function formatCreatedDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}
