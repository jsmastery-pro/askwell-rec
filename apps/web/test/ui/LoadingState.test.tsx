import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoadingState } from "../../components/ui";

describe("LoadingState", () => {
  it("is a polite status region with its title and text", () => {
    const html = renderToStaticMarkup(<LoadingState title="Loading" text="One moment." />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Loading");
    expect(html).toContain("One moment.");
  });

  it("stops the spinner under reduced motion", () => {
    expect(renderToStaticMarkup(<LoadingState title="Loading" />)).toContain(
      "motion-reduce:animate-none",
    );
  });
});
