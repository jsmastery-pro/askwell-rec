import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, ErrorState } from "../../components/ui";

describe("ErrorState", () => {
  it("is an alert with title, text and action", () => {
    const html = renderToStaticMarkup(
      <ErrorState title="Something broke" text="Try again." action={<Button>Retry</Button>} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Something broke");
    expect(html).toContain("Try again.");
    expect(html).toContain("Retry</button>");
  });
});
