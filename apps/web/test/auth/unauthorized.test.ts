import { describe, expect, it } from "vitest";
import { unauthorizedBody } from "../../lib/auth/unauthorized";

describe("unauthorizedBody", () => {
  it("has the API error shape", () => {
    expect(unauthorizedBody()).toEqual({
      error: { code: "unauthorized", message: expect.any(String) },
    });
  });
});
