import { APP_NAME } from "@askwell/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Footer } from "../../components/landing";

describe("Footer", () => {
  const html = renderToStaticMarkup(<Footer />);

  it("is a footer landmark with the app name", () => {
    expect(html).toMatch(/^<footer/);
    expect(html).toContain(APP_NAME);
  });

  it("links to sign in and sign up", () => {
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain('href="/sign-up"');
  });
});
