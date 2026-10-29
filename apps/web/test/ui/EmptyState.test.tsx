import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, EmptyState } from "../../components/ui";

describe("EmptyState", () => {
  it("renders title, text and action", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="No projects"
        text="Create your first one."
        action={<Button>Create</Button>}
      />,
    );
    expect(html).toContain("No projects");
    expect(html).toContain("Create your first one.");
    expect(html).toContain("Create</button>");
  });

  it("omits text and action when not given", () => {
    const html = renderToStaticMarkup(<EmptyState title="Nothing here" />);
    expect(html).toContain("Nothing here");
    expect(html).not.toContain("<p");
  });
});
