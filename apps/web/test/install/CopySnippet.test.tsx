import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CopySnippet } from "../../components/install/CopySnippet";

describe("CopySnippet", () => {
  it("renders the snippet as text in a wrapping code block, with a Copy button and a live region", () => {
    const html = renderToStaticMarkup(
      <CopySnippet
        snippet={'<script src="https://a.example/widget.js" data-key="pk_x" async></script>'}
      />,
    );
    expect(html).toContain(
      "<code>&lt;script src=&quot;https://a.example/widget.js&quot; data-key=&quot;pk_x&quot; async&gt;&lt;/script&gt;</code>",
    );
    expect(html).toMatch(/<pre class="[^"]*whitespace-pre-wrap[^"]*break-all/);
    expect(html).toMatch(/<button type="button"[^>]*>Copy<\/button>/);
    expect(html).toContain('aria-live="polite"');
  });
});
