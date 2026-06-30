/** The Markdown mark (github/markdown-mark, CC0). Inherits color via `currentColor`. */
export function MarkdownMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 208 128"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15 10c-2.761 0-5 2.239-5 5v98c0 2.761 2.239 5 5 5h178c2.761 0 5-2.239 5-5V15c0-2.761-2.239-5-5-5H15zM0 15C0 6.716 6.716 0 15 0h178c8.284 0 15 6.716 15 15v98c0 8.284-6.716 15-15 15H15c-8.284 0-15-6.716-15-15V15z"
        fill="currentColor"
      />
      <path
        d="M30 98V30h20l20 25 20-25h20v68H90V59L70 84 50 59v39H30zM155 98l-30-33h20V30h20v35h20l-30 33z"
        fill="currentColor"
      />
    </svg>
  );
}
