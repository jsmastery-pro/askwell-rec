import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InstallSnippet } from "../../components/landing";
import { SNIPPET } from "../../components/landing/InstallSnippet";

describe("InstallSnippet", () => {
  const html = renderToStaticMarkup(<InstallSnippet />);

  it("shows the snippet as escaped text, not a live script tag", () => {
    expect(SNIPPET).toContain("<script");
    expect(html).toContain("&lt;script");
    expect(html).not.toContain("<script");
  });

  it("scrolls inside its box on a narrow screen", () => {
    expect(html).toContain("overflow-x-auto");
  });
});
