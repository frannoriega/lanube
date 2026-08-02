"use client";

import { MarkdownMark } from "@/components/atoms/markdown-mark";
import { Markdown } from "@/components/molecules/markdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Bold,
  Code,
  Heading,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
  Quote,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// External Spanish markdown reference shown by the "Soporta markdown" badge.
const MARKDOWN_DOCS_URL = "https://markdown.es/sintaxis/";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  /** Minimum / maximum character count. When set, a live counter shows in the footer. */
  minLength?: number;
  maxLength?: number;
  ariaDescribedBy?: string;
  /**
   * Endpoint (accepts `multipart/form-data` with a `file` field, returns `{ url }`) enabling the
   * image + file attachment buttons. Omitted → those buttons are hidden.
   */
  uploadUrl?: string;
}

/**
 * Markdown description editor: a formatting toolbar over a plain textarea (the stored value is
 * markdown), with a "Vista previa" tab that renders it via <Markdown>. The toolbar emits only
 * standard CommonMark/GFM syntax. When `uploadUrl` is set, image/file buttons upload an asset and
 * insert the corresponding markdown (`![name](url)` / `[name](url)`).
 */
export function MarkdownEditor({
  value,
  onChange,
  id,
  placeholder,
  rows = 5,
  required,
  minLength,
  maxLength,
  ariaDescribedBy,
  uploadUrl,
}: MarkdownEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Selection to restore after a toolbar edit re-renders the textarea.
  const pendingSelection = useRef<[number, number] | null>(null);
  // Selection captured when a file picker opens (async upload may resolve after focus is lost).
  const uploadSelection = useRef<[number, number] | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (pendingSelection.current && ref.current) {
      const [start, end] = pendingSelection.current;
      ref.current.focus();
      ref.current.setSelectionRange(start, end);
      pendingSelection.current = null;
    }
  });

  /** Wrap the current selection (or a placeholder) with inline markers. */
  const surround = (before: string, after = before, placeholder = "texto") => {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const selected = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    pendingSelection.current = [
      s + before.length,
      s + before.length + selected.length,
    ];
    onChange(next);
  };

  /** Prepend a marker (e.g. "### ", "- ", "1. ", "> ") to every line in the selection. */
  const prefixLines = (prefix: string) => {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const block = value.slice(lineStart, e) || "texto";
    const replaced = block
      .split("\n")
      .map((line) => prefix + line)
      .join("\n");
    const next = value.slice(0, lineStart) + replaced + value.slice(e);
    pendingSelection.current = [lineStart, lineStart + replaced.length];
    onChange(next);
  };

  /** Inline code for a single-line selection, a fenced block when it spans lines. */
  const codeFormat = () => {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const selected = value.slice(s, e);
    if (selected.includes("\n")) {
      const block = `\`\`\`\n${selected || "código"}\n\`\`\``;
      const next = value.slice(0, s) + block + value.slice(e);
      pendingSelection.current = [s + 4, s + 4 + (selected || "código").length];
      onChange(next);
    } else {
      surround("`", "`", "código");
    }
  };

  const insertLink = () => {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const label = value.slice(s, e) || "texto del enlace";
    const snippet = `[${label}](https://)`;
    const next = value.slice(0, s) + snippet + value.slice(e);
    // Select the "https://" so the user can replace it immediately.
    const urlStart = s + label.length + 3;
    pendingSelection.current = [urlStart, urlStart + 8];
    onChange(next);
  };

  /** Remember where to drop the uploaded asset, then open the given picker. */
  const openPicker = (which: "image" | "file") => {
    const ta = ref.current;
    uploadSelection.current = ta ? [ta.selectionStart, ta.selectionEnd] : null;
    (which === "image" ? imageInputRef : fileInputRef).current?.click();
  };

  const uploadAndInsert = async (file: File, kind: "image" | "file") => {
    if (!uploadUrl) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(uploadUrl, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo subir el archivo");
        return;
      }
      const name = file.name.replace(/\.[^.]+$/, "");
      const snippet =
        kind === "image" ? `![${name}](${data.url})` : `[${name}](${data.url})`;
      const [s, e] = uploadSelection.current ?? [value.length, value.length];
      // A new line before/after keeps a block image/link from gluing onto surrounding text.
      const before = s > 0 && value[s - 1] !== "\n" ? "\n\n" : "";
      const next = value.slice(0, s) + before + snippet + "\n" + value.slice(e);
      const caret = s + before.length + snippet.length + 1;
      pendingSelection.current = [caret, caret];
      onChange(next);
      toast.success(kind === "image" ? "Imagen subida" : "Archivo subido");
    } finally {
      setUploading(false);
    }
  };

  // Optional character counter — only shown when a min and/or max is configured.
  const length = value.trim().length;
  let counter: { text: string; warn: boolean } | null = null;
  if (minLength != null && length < minLength) {
    counter = {
      text: `Mínimo ${minLength} · faltan ${minLength - length}`,
      warn: true,
    };
  } else if (maxLength != null && length > maxLength) {
    counter = {
      text: `Máximo ${maxLength} · sobran ${length - maxLength}`,
      warn: true,
    };
  } else if (minLength != null || maxLength != null) {
    counter = {
      text:
        maxLength != null ? `${length}/${maxLength}` : `${length} caracteres`,
      warn: false,
    };
  }

  return (
    <Tabs defaultValue="write" className="rounded-md border gap-0">
      <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5">
        <div
          role="toolbar"
          aria-label="Formato de texto"
          className="flex flex-wrap items-center gap-0.5"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Título"
                title="Título"
              >
                <Heading className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => prefixLines("# ")}
                className="text-xl font-bold"
              >
                Título 1
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => prefixLines("## ")}
                className="text-lg font-bold"
              >
                Título 2
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => prefixLines("### ")}
                className="text-base font-semibold"
              >
                Título 3
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarButton label="Negrita" onClick={() => surround("**")}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Cursiva" onClick={() => surround("_")}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Cita" onClick={() => prefixLines("> ")}>
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Código" onClick={codeFormat}>
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Enlace" onClick={insertLink}>
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <ToolbarButton
            label="Lista numerada"
            onClick={() => prefixLines("1. ")}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Lista" onClick={() => prefixLines("- ")}>
            <List className="h-4 w-4" />
          </ToolbarButton>
          {uploadUrl && (
            <>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <ToolbarButton
                label="Imagen"
                onClick={() => openPicker("image")}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
              </ToolbarButton>
              <ToolbarButton
                label="Adjuntar archivo (PDF)"
                onClick={() => openPicker("file")}
                disabled={uploading}
              >
                <Paperclip className="h-4 w-4" />
              </ToolbarButton>
            </>
          )}
        </div>
        <TabsList className="h-8">
          <TabsTrigger value="write" className="text-xs">
            Escribir
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs">
            Vista previa
          </TabsTrigger>
        </TabsList>
      </div>

      {uploadUrl && (
        <>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAndInsert(file, "image");
              e.target.value = "";
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAndInsert(file, "file");
              e.target.value = "";
            }}
          />
        </>
      )}

      <TabsContent value="write" className="m-0">
        <Textarea
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          required={required}
          minLength={minLength}
          aria-describedby={ariaDescribedBy}
          className="resize-y rounded-none border-0 shadow-none focus-visible:ring-0"
        />
      </TabsContent>

      <TabsContent value="preview" className="m-0">
        <div className="min-h-[7.5rem] px-3 py-2">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Nada para previsualizar.
            </p>
          )}
        </div>
      </TabsContent>

      <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5">
        <a
          href={MARKDOWN_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <MarkdownMark className="h-3.5 w-auto" />
          Soporta markdown
        </a>
        {counter && (
          <span
            className={
              counter.warn
                ? "text-xs font-medium text-destructive tabular-nums"
                : "text-xs text-muted-foreground tabular-nums"
            }
          >
            {counter.text}
          </span>
        )}
      </div>
    </Tabs>
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
