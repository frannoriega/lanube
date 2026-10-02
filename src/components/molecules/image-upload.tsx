"use client";

import { FramedImage } from "@/components/molecules/framed-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Endpoint that accepts `multipart/form-data` with a `file` field and returns `{ url }`. */
  uploadUrl: string;
  /** Accessible alt text / context for the previewed image. */
  alt?: string;
  /** Sizing for the preview/dropzone box. Defaults to a compact banner, not full card width. */
  containerClassName?: string;
  disabled?: boolean;
  /**
   * Texto de ayuda bajo el recuadro (p. ej. `<CoverImageHint />`). Si se pasa, además se
   * avisa (sin bloquear) cuando la imagen elegida es chica — ver `SMALL_IMAGE_LONG_SIDE`.
   */
  hint?: ReactNode;
}

/**
 * Por debajo de este lado mayor (en px) la imagen se ve borrosa en el marco más grande donde
 * se muestra (la portada del detalle de una noticia, ~900 px de ancho). 1080 deja pasar el
 * tamaño estándar de un post de Instagram (1080 × 1350 / 1080 × 1080), que es lo que más se
 * reusa. Es sólo un aviso: nunca rechaza la subida.
 */
const SMALL_IMAGE_LONG_SIDE = 1080;

/**
 * Tamaño recomendado para portadas de noticias y eventos, en píxeles y no sólo en
 * proporción: quienes suben no son especialistas y diseñan en Canva, donde se elige un
 * tamaño en px. 1920 × 1080 es el formato "Presentación (16:9)" de Canva.
 */
export const COVER_IMAGE_RECOMMENDED = { width: 1920, height: 1080 } as const;

/**
 * Ayuda para portadas, pensada para no especialistas: el tamaño en px primero (lo que se
 * elige en Canva), la proporción entre paréntesis por las dudas, y la tranquilidad de que un
 * flyer vertical también sirve (se ve completo, ver `FramedImage`).
 */
export function CoverImageHint() {
  const { width, height } = COVER_IMAGE_RECOMMENDED;
  return (
    <>
      <span className="block">
        <span className="font-medium text-foreground">Tamaño ideal:</span>{" "}
        {width} × {height} px (horizontal, proporción 16:9). En Canva es el
        formato «Presentación».
      </span>
      <span className="block">
        Las imágenes verticales o cuadradas (como un flyer de Instagram de 1080
        × 1350 px) también sirven: se muestran completas, con un fondo
        difuminado a los costados.
      </span>
    </>
  );
}

/**
 * Lee el ancho y alto reales del archivo en el navegador, antes de subirlo. `null` si el
 * navegador no puede decodificarlo (no es motivo para frenar la subida: el server valida).
 */
async function readImageSize(
  file: File,
): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
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
  containerClassName = "h-32 w-full max-w-md",
  disabled,
  hint,
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
      if (hint) {
        const size = await readImageSize(file);
        if (size && Math.max(size.width, size.height) < SMALL_IMAGE_LONG_SIDE) {
          const { width, height } = COVER_IMAGE_RECOMMENDED;
          toast.warning("La imagen es chica y puede verse borrosa", {
            description: `Mide ${size.width} × ${size.height} px. Si podés, exportala más grande (por ejemplo, ${width} × ${height} px).`,
          });
        }
      }
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
          {/* Igual que en el sitio público: completa, sin recorte. Así quien sube ve lo
              mismo que va a ver el visitante. */}
          <FramedImage
            src={value}
            alt={alt}
            sizes="(max-width: 672px) 100vw, 672px"
            className="absolute inset-0"
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

      {hint && (
        <p className="space-y-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
