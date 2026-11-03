import { describe, expect, it } from "vitest";

// No `server-only` mock here: outside the react-server build the real module throws.
describe("lib/ai", () => {
  it("can't be imported outside the server", async () => {
    await expect(import("../../lib/ai")).rejects.toThrow(/Client Component/);
    await expect(import("../../lib/ai/prompt")).rejects.toThrow(/Client Component/);
  });
});
