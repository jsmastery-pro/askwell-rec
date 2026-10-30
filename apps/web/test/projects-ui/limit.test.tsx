import { PLAN_LIMITS, PROJECT_NAME_MAX_LENGTH } from "@askwell/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  LimitReachedMessage,
  formatCreatedDate,
  projectErrorText,
  projectLimitText,
} from "../../components/projects";

describe("limit message", () => {
  it("Free: the number comes from PLAN_LIMITS, with an Upgrade link to billing", () => {
    const html = renderToStaticMarkup(<LimitReachedMessage plan="free" />);
    const free = PLAN_LIMITS.free.projects;

    expect(html).toContain('role="alert"');
    expect(html).toContain(
      `The Free plan allows ${free} project${free === 1 ? "" : "s"}. Upgrade to Pro for up to ${PLAN_LIMITS.pro.projects} projects.`,
    );
    expect(html).toMatch(/<a [^>]*href="\/dashboard\/billing"[^>]*>Upgrade<\/a>/);
  });

  it("Pro: its own limit, and no Upgrade link", () => {
    const html = renderToStaticMarkup(<LimitReachedMessage plan="pro" />);
    expect(html).toContain(`The Pro plan allows ${PLAN_LIMITS.pro.projects} projects.`);
    expect(html).not.toContain("/dashboard/billing");
  });

  it("follows PLAN_LIMITS rather than a hardcoded number", () => {
    expect(projectLimitText("free")).toContain(`allows ${PLAN_LIMITS.free.projects} project`);
    expect(projectLimitText("pro")).toContain(`allows ${PLAN_LIMITS.pro.projects} projects`);
  });
});

describe("projectErrorText", () => {
  it.each([
    ["invalid_input", `Enter a name of 1 to ${PROJECT_NAME_MAX_LENGTH} characters.`],
    ["unauthorized", "Your session ended. Sign in again."],
    ["not_found", "This project no longer exists. Reload the page."],
    ["internal", "Something went wrong. Try again."],
  ] as const)("%s → %s", (code, text) => {
    expect(projectErrorText({ code, message: "server text" })).toBe(text);
  });
});

describe("formatCreatedDate", () => {
  it("formats in UTC, so server and tests agree", () => {
    expect(formatCreatedDate("2026-10-30T23:59:59+00:00")).toBe("Oct 30, 2026");
    expect(formatCreatedDate("2026-10-31T01:00:00+02:00")).toBe("Oct 30, 2026");
  });
});
