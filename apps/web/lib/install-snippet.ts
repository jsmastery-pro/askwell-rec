import { PublicKeySchema } from "@askwell/shared";

/**
 * The tag an owner pastes on their site. `async` is safe: the loader reads
 * `document.currentScript` while it first runs (set for async classic scripts too) and waits
 * for DOMContentLoaded itself when the page is still loading.
 */
export function buildInstallSnippet(appUrl: string, publicKey: string): string {
  // Keys are generated in this format; anything else could break out of the attribute.
  PublicKeySchema.parse(publicKey);
  return `<script src="${appUrl}/widget.js" data-key="${publicKey}" async></script>`;
}
