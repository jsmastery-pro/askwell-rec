import { ApiErrorSchema } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { UNAUTHORIZED_STATUS, unauthorizedBody } from "../../lib/auth/unauthorized";

describe("unauthorizedBody", () => {
  it("is a valid ApiError with the unauthorized code", () => {
    const body = ApiErrorSchema.parse(unauthorizedBody());
    expect(body.error.code).toBe("unauthorized");
  });

  it("is sent with status 401", () => {
    expect(UNAUTHORIZED_STATUS).toBe(401);
  });
});
