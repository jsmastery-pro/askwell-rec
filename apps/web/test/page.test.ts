import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APP_NAME } from "@askwell/shared";
import Home from "../app/page";

describe("home page", () => {
  const html = renderToStaticMarkup(createElement(Home));

  it("shows APP_NAME", () => {
    expect(html).toContain(APP_NAME);
  });

  it("renders the six sections on the dark surface", () => {
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('aria-labelledby="hero-title"');
    for (const id of ["how-it-works", "demo", "pricing", "install"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("<footer");
  });

  it("links Start free to /sign-up", () => {
    expect(html).toMatch(/href="\/sign-up"[^>]*>Start free</);
  });
});
