import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

interface LogoProps {
  /** Ancho en px; el alto sale de la proporción del sello (casi cuadrado). */
  size?: number;
  /**
   * Clases extra. El color del sello es el color del texto (`bg-current`): pasá un `text-*`
   * para cambiarlo. Por defecto usa el azul de marca (`la-nube-selected`) en modo claro y el
   * celeste (`la-nube-secondary`) en modo oscuro, la misma regla que el texto de marca.
   */
  className?: string;
}

/**
 * Tamaño intrínseco de `public/images/logos/municipio-seal.png`. Se extrajo de la versión blanca
 * del sello nuevo de la Municipalidad (export de Canva: una máscara rasterizada dentro de un SVG),
 * recortada al contenido. Es blanco sobre transparente porque solo se usa como máscara.
 */
const SEAL_W = 640;
const SEAL_H = 637;

/**
 * Sello de la Municipalidad de Concepción del Uruguay (v1.3.1): el escudo «CDU» con
 * «Municipalidad · Concepción del Uruguay» en círculo. Es monocromo, así que se dibuja como
 * **máscara CSS** sobre el color del texto en lugar de una imagen con colores fijos: así un solo
 * archivo sirve para el modo claro, el oscuro y la banda oscura del footer.
 *
 * Reemplaza al escudo a color (`crest.tsx`) del header y al logo con nombre del footer.
 *
 * Es `block`, no `inline-block`: dentro de un `<Link>` un `inline-block` se apoya en la línea
 * base del texto y deja debajo el espacio de los descendentes (~6 px vacíos bajo el sello).
 */
export default function LogoMunicipio({ size = 40, className }: LogoProps) {
  const style: CSSProperties = {
    width: size,
    height: Math.round((size * SEAL_H) / SEAL_W),
    maskImage: "url(/images/logos/municipio-seal.png)",
    WebkitMaskImage: "url(/images/logos/municipio-seal.png)",
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  };
  return (
    <span
      role="img"
      aria-label="Municipalidad de Concepción del Uruguay"
      className={cn(
        "block shrink-0 bg-current text-la-nube-selected dark:text-la-nube-secondary",
        className,
      )}
      style={style}
    />
  );
}
