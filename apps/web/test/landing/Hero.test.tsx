import { APP_NAME } from "@askwell/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Hero } from "../../components/landing";

describe("Hero", () => {
  const html = renderToStaticMarkup(<Hero />);

  it("has one h1 and names the app from APP_NAME", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(APP_NAME);
  });

  it("has a Start free CTA linking to /sign-up", () => {
    expect(html).toMatch(/<a [^>]*href="\/sign-up"[^>]*>Start free<\/a>/);
  });

  it("uses the entrance motion helper", () => {
    expect(html).toContain("motion-enter");
  });
});
