"use client";

import { useEffect, useState } from "react";

/**
 * Contenedor sticky de la barra pública que marca `data-scrolled="true"` en cuanto la página
 * deja de estar arriba de todo (milestone 18). No pinta nada por sí mismo: las píldoras de
 * vidrio de adentro (`.glass-nav`, en `globals.css`) leen ese atributo para mostrar su canto
 * y su sombra. Así el encabezado sigue siendo un Server Component y lo único cliente es este
 * listener de scroll (pasivo, con un umbral chico para que no parpadee en el primer píxel).
 */
export function ScrollAwareHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={className} data-scrolled={scrolled ? "true" : "false"}>
      {children}
    </div>
  );
}
