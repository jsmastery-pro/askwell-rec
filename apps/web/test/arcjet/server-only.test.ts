import { describe, expect, it } from "vitest";

// No `server-only` mock here: outside the react-server build the real module throws.
describe("lib/arcjet", () => {
  it("can't be imported outside the server", async () => {
    await expect(import("../../lib/arcjet")).rejects.toThrow(/Client Component/);
  });
});
