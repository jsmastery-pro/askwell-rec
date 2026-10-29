import { describe, expect, it } from "vitest";

describe("widget entry", () => {
  it("loads without side effects", async () => {
    await expect(import("../src/index")).resolves.toBeDefined();
  });
});
