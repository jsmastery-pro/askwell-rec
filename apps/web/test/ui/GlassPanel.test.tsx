import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlassPanel } from "../../components/ui";

describe("GlassPanel", () => {
  it("renders its children in a blurred, translucent panel", () => {
    const html = renderToStaticMarkup(<GlassPanel className="p-4">Hello</GlassPanel>);
    expect(html).toContain("Hello");
    expect(html).toContain("backdrop-blur-glass");
    expect(html).toContain("bg-glass");
    expect(html).toContain("p-4");
  });
});
