import Image from "next/image";

interface LogoProps {
  /** Rendered height in px. Width is derived from the emblem's aspect ratio. */
  size?: number;
  className?: string;
}

// Intrinsic size of the extracted emblem (public/images/logos/municipio-crest.png).
const CREST_W = 1685;
const CREST_H = 1731;

/**
 * Simplified Municipalidad de Concepción del Uruguay mark: the CDU emblem
 * (coat of arms) only, without the "Municipalidad de Concepción del Uruguay"
 * wordmark. Use where space is tight (e.g. the navbar); the full wordmark logo
 * (`LogoMunicipio`) still lives in the footer.
 */
export default function LogoMunicipioCrest({
  size = 40,
  className,
}: LogoProps) {
  const width = Math.round((size * CREST_W) / CREST_H);
  return (
    <Image
      src="/images/logos/municipio-crest.png"
      alt="Municipalidad de Concepción del Uruguay"
      width={width}
      height={size}
      className={className}
      priority
    />
  );
}
