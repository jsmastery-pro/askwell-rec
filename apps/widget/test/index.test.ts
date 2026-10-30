import { afterEach, describe, expect, it, vi } from "vitest";

describe("widget entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders nothing and fetches nothing without its own <script>", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    // Under vitest, `document.currentScript` is null, as for a module or a late call.
    await import("../src/index");
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.innerHTML).toBe("");
  });
});
