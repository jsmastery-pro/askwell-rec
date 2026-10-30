import { describe, expect, it } from "vitest";
import { buildInstallSnippet } from "../../lib/install-snippet";

const KEY = "pk_AbCdEfGhIjKlMnOpQrStUvWxYz012345";

describe("buildInstallSnippet", () => {
  it("returns exactly the script tag", () => {
    expect(buildInstallSnippet("https://askwell.example", KEY)).toBe(
      `<script src="https://askwell.example/widget.js" data-key="${KEY}" async></script>`,
    );
  });

  it("uses the given app URL as is (a preview's own address)", () => {
    expect(
      buildInstallSnippet("https://askwell-rec-abc123-team.vercel.app", "pk_test_abc12345"),
    ).toBe(
      '<script src="https://askwell-rec-abc123-team.vercel.app/widget.js" data-key="pk_test_abc12345" async></script>',
    );
  });

  it.each(['pk_"><script>alert(1)</script>', "sk_secret_123456789", ""])(
    "rejects a key outside the public key format: %s",
    (key) => {
      expect(() => buildInstallSnippet("https://askwell.example", key)).toThrow();
    },
  );
});
