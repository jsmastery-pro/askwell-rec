import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APP_NAME } from "@askwell/shared";
import Home from "../app/page";

describe("home page", () => {
  it("shows APP_NAME", () => {
    const html = renderToStaticMarkup(createElement(Home));
    expect(html).toContain(APP_NAME);
  });
});
