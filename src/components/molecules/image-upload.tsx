"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Endpoint that accepts `multipart/form-data` with a `file` field and returns `{ url }`. */
  uploadUrl: string;
  /** Accessible alt text / context for the previewed image. */
  alt?: string;
  /** Sizing for the preview/dropzone box. Defaults to a full-width 16:9 banner. */
  containerClassName?: string;
  disabled?: boolean;
}

/**
 * Reusable image picker with preview, upload progress and removal. Posts the selected file
 * to `uploadUrl` and reports back the stored URL via `onChange`. Storage backend is
 * abstracted server-side (see src/lib/storage).
 */
export function ImageUpload({
  value,
  onChange,
  uploadUrl,
  alt = "Imagen",
  containerClassName = "aspect-[16/9] w-full",
  disabled,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(uploadUrl, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo subir la imagen");
        return;
      }
      onChange(data.url as string);
      toast.success("Imagen subida");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {value ? (
        <div
          className={cn(
            "relative overflow-hidden rounded-lg border bg-muted",
            containerClassName,
          )}
        >
          <Image
            src={value}
            alt={alt}
            fill
            sizes="(max-width: 672px) 100vw, 672px"
            className="object-cover"
          />
          <div className="absolute right-2 top-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              Cambiar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              aria-label="Quitar imagen"
              disabled={disabled || uploading}
              onClick={() => onChange(null)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 text-muted-foreground transition-colors hover:border-la-nube-primary hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60",
            containerClassName,
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <ImagePlus className="h-6 w-6" />
          )}
          <span className="text-sm">
            {uploading ? "Subiendo…" : "Subir imagen"}
          </span>
          <span className="text-xs">JPG, PNG, WebP o GIF · hasta 5 MB</span>
        </button>
      )}
    </div>
  );
}
