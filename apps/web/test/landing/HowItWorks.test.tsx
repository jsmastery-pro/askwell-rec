import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HowItWorks } from "../../components/landing";
import { STEPS } from "../../components/landing/HowItWorks";

describe("HowItWorks", () => {
  const html = renderToStaticMarkup(<HowItWorks />);

  it("shows the three steps in order", () => {
    expect(STEPS.map((s) => s.title)).toEqual([
      "Create a project",
      "Add knowledge",
      "Paste the snippet",
    ]);
    const positions = STEPS.map((s) => html.indexOf(s.title));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("is an ordered list with the section anchor", () => {
    expect(html).toContain('id="how-it-works"');
    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html).toContain("<ol");
  });
});
