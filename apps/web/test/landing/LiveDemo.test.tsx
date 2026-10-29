import { APP_NAME } from "@askwell/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LiveDemo } from "../../components/landing";

describe("LiveDemo", () => {
  const html = renderToStaticMarkup(<LiveDemo />);

  it("shows a static example conversation under the app name", () => {
    expect(html).toContain('aria-label="Example conversation"');
    expect(html).toContain(APP_NAME);
    expect(html).toContain("Example only");
  });

  it("has no live input or script (the real widget lands in Phase 6)", () => {
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<script");
  });
});
