import { cn } from "@/lib/utils";
import Image from "next/image";

/**
 * Imagen subida por un admin dentro de un marco de proporción fija, **sin recortarla**.
 *
 * Por qué: quienes suben portadas (noticias, eventos) no son especialistas y suelen reusar
 * flyers pensados para Instagram (4:5, 1:1, 9:16). Con `object-cover` en un marco 16:9, un
 * flyer vertical perdía más de la mitad de su alto — justo el título y los logos. Forzar una
 * proporción al subir tampoco sirve: no van a rehacer el flyer.
 *
 * Cómo: el marco lo define el padre (vía `className`), así el layout nunca depende de la
 * imagen. Adentro se dibuja la imagen completa (`object-contain`) y, detrás, una copia
 * agrandada, difuminada y oscurecida que rellena las bandas vacías — el mismo patrón que usan
 * Instagram o YouTube con proporciones raras. Cualquier proporción queda bien sin casos
 * especiales: un flyer vertical tiene bandas a los costados, una panorámica arriba y abajo, y
 * una foto 16:9 simplemente llena el marco.
 *
 * Las dos capas usan el mismo `src` y `sizes`, así que el navegador descarga una sola vez.
 *
 * `fit="cover"` vuelve al recorte clásico: sólo para miniaturas chicas (un cuadrado de 48 px),
 * donde un flyer entero sería ilegible igual y el recorte se lee mejor como "ícono".
 *
 * `imageClassName` se aplica a una capa que envuelve a ambas imágenes (lo usa, por ejemplo,
 * el zoom en hover de las tarjetas, para que fondo y frente se muevan juntos sin pisar la
 * escala propia del fondo).
 */
export function FramedImage({
  src,
  alt,
  sizes,
  priority,
  fit = "contain",
  className,
  imageClassName,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  fit?: "contain" | "cover";
  className?: string;
  imageClassName?: string;
}) {
  if (fit === "cover") {
    return (
      <div className={cn("relative overflow-hidden bg-muted", className)}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", imageClassName)}
        />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <div className={cn("absolute inset-0", imageClassName)}>
        {/* Fondo: la misma imagen, agrandada para que el blur no deje bordes claros, y
          oscurecida para que la imagen nítida se despegue. Decorativa: el alt va en el frente. */}
        <Image
          src={src}
          alt=""
          aria-hidden="true"
          fill
          sizes={sizes}
          priority={priority}
          className="scale-110 object-cover blur-2xl brightness-75 saturate-125"
        />
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-contain"
        />
      </div>
    </div>
  );
}
