import { describe, expect, it } from "vitest";
import { APP_NAME } from "../src";

describe("APP_NAME", () => {
  it("is Askwell", () => {
    expect(APP_NAME).toBe("Askwell");
  });
});
