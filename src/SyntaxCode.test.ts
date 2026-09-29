import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SyntaxCode from "./SyntaxCode";

describe("syntax rendering", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`highlights TypeScript without interpreting markup in ${theme} mode`, () => {
      const html = renderToStaticMarkup(
        createElement(SyntaxCode, {
          code: 'const payload = "<img src=x onerror=alert(1)>";\n// Inspect, then approve.',
          language: "typescript",
          theme,
          label: "Integration example",
        }),
      );
      expect(html).toContain('class="token keyword"');
      expect(html).toContain('class="token string"');
      expect(html).toContain('class="token comment"');
      expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
      expect(html).not.toContain("<img");
      expect(html).toContain('aria-hidden="true" data-line="2"');
    });

    it(`treats JSON response values as text in ${theme} mode`, () => {
      const html = renderToStaticMarkup(
        createElement(SyntaxCode, {
          code: JSON.stringify(
            { result: "</script><script>alert(1)</script>", success: true },
            null,
            2,
          ),
          language: "json",
          theme,
          label: "Response JSON",
        }),
      );
      expect(html).toContain('class="token property"');
      expect(html).toContain('class="token boolean"');
      expect(html).toContain("&lt;/script&gt;");
      expect(html).not.toContain("<script");
    });
  }
});
