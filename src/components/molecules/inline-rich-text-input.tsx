"use client";

import { InlineRichText } from "@/components/molecules/inline-rich-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { INLINE_DELIMITERS, type InlineMark } from "@/lib/events/inline-format";
import { Bold, Italic, Underline } from "lucide-react";
import { useEffect, useRef } from "react";

interface InlineRichTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
}

/**
 * Editor for the event `summary`: a textarea with a small bold / italic / underline toolbar and a
 * live preview. It only ever emits the three inline delimiters (see {@link INLINE_DELIMITERS}) —
 * no block markdown — matching what {@link InlineRichText} renders on the cards.
 */
export function InlineRichTextInput({
  value,
  onChange,
  onBlur,
  name,
  id,
  placeholder,
  rows = 2,
  maxLength,
  disabled,
}: InlineRichTextInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (pendingSelection.current && ref.current) {
      const [start, end] = pendingSelection.current;
      ref.current.focus();
      ref.current.setSelectionRange(start, end);
      pendingSelection.current = null;
    }
  });

  const apply = (mark: InlineMark) => {
    const ta = ref.current;
    if (!ta) return;
    const token = INLINE_DELIMITERS[mark];
    const { selectionStart: s, selectionEnd: e } = ta;
    const selected = value.slice(s, e) || "texto";
    const next = value.slice(0, s) + token + selected + token + value.slice(e);
    pendingSelection.current = [
      s + token.length,
      s + token.length + selected.length,
    ];
    onChange(next);
  };

  const length = value.length;

  return (
    <div className="rounded-md border">
      <div
        role="toolbar"
        aria-label="Formato de texto"
        className="flex items-center gap-0.5 border-b px-2 py-1.5"
      >
        <ToolbarButton
          label="Negrita"
          disabled={disabled}
          onClick={() => apply("bold")}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Cursiva"
          disabled={disabled}
          onClick={() => apply("italic")}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Subrayado"
          disabled={disabled}
          onClick={() => apply("underline")}
        >
          <Underline className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <Textarea
        id={id}
        name={name}
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        className="resize-y rounded-none border-0 shadow-none focus-visible:ring-0"
      />

      <div className="flex min-h-8 items-center justify-between gap-2 border-t px-3 py-1.5">
        {value.trim() ? (
          <InlineRichText
            text={value}
            className="line-clamp-1 text-sm text-muted-foreground"
          />
        ) : (
          <span className="text-xs italic text-muted-foreground">
            Vista previa
          </span>
        )}
        {maxLength != null && (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
