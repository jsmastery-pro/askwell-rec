import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "../../components/ui";

describe("Button", () => {
  it("renders a button that does not submit by default", () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(html).toMatch(/^<button /);
    expect(html).toContain('type="button"');
    expect(html).toContain("Save");
    expect(html).toContain("bg-fg");
  });

  it("renders each variant", () => {
    expect(renderToStaticMarkup(<Button variant="secondary">A</Button>)).toContain("bg-glass");
    expect(renderToStaticMarkup(<Button variant="ghost">A</Button>)).toContain("hover:bg-fg/10");
  });

  it("renders a link when given href", () => {
    const html = renderToStaticMarkup(<Button href="/dashboard">Open</Button>);
    expect(html).toMatch(/^<a /);
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain("Open");
  });
});
