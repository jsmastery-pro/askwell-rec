import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Input } from "../../components/ui";

describe("Input", () => {
  it("renders a text input with the given props", () => {
    const html = renderToStaticMarkup(<Input name="email" placeholder="you@example.com" />);
    expect(html).toMatch(/^<input /);
    expect(html).toContain('name="email"');
    expect(html).toContain('placeholder="you@example.com"');
    expect(html).not.toContain("aria-invalid");
  });

  it("marks an invalid input", () => {
    const html = renderToStaticMarkup(<Input invalid />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("border-danger-fg");
  });
});
