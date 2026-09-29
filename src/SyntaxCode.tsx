import { memo } from "react";
import { Highlight, themes } from "prism-react-renderer";
import type { Theme } from "./theme";

type Props = {
  code: string;
  language: "typescript" | "json";
  theme: Theme;
  label: string;
};

// Match the extension playground while keeping all payloads escaped React text.
export default memo(function SyntaxCode({
  code,
  language,
  theme,
  label,
}: Props) {
  return (
    <Highlight
      code={code}
      language={language}
      theme={theme === "dark" ? themes.nightOwl : themes.nightOwlLight}
    >
      {({ className, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`code-block code-block-highlighted ${className}`}
          aria-label={label}
          tabIndex={0}
        >
          <code>
            {tokens.map((line, lineIndex) => (
              <span
                {...getLineProps({
                  line,
                  className: "syntax-line",
                  style: { background: "transparent" },
                })}
                key={lineIndex}
              >
                <span
                  className="syntax-line-number"
                  aria-hidden="true"
                  data-line={lineIndex + 1}
                />
                <span className="syntax-line-content">
                  {line.map((token, tokenIndex) => (
                    <span {...getTokenProps({ token })} key={tokenIndex} />
                  ))}
                </span>
              </span>
            ))}
          </code>
        </pre>
      )}
    </Highlight>
  );
});
