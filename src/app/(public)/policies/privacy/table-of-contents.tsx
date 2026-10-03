"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface Entry {
  id: string;
  text: string;
}

/**
 * Índice de la política de privacidad (milestone 18). Se arma leyendo los `h2[id]` ya
 * renderizados dentro de `#politica`, así que nunca se desincroniza del MDX: si se agrega o
 * renombra una sección, el índice la refleja sin tocar este archivo.
 *
 * Marca la sección que se está leyendo (la última cuyo título ya pasó bajo el header). Sin
 * JavaScript no se muestra — la política se lee igual, el índice es sólo un atajo.
 */
export function TableOfContents() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const headings = Array.from(
      document.querySelectorAll<HTMLHeadingElement>("#politica h2[id]"),
    );
    setEntries(
      headings.map((h) => ({ id: h.id, text: h.textContent?.trim() ?? "" })),
    );

    // La sección activa es la última cuyo título ya pasó por debajo del header fijo (~120px).
    // Se calcula por posición en cada scroll (no con IntersectionObserver): así también es
    // correcta al saltar de golpe a cualquier punto, p. ej. volviendo arriba de todo.
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = headings[0]?.id ?? null;
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= 120) current = h.id;
        else break;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="Índice de la política" className="flex flex-col gap-3">
      <span className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        En esta página
      </span>
      <ol className="flex flex-col border-l border-border">
        {entries.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              aria-current={active === e.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-colors",
                active === e.id
                  ? "border-la-nube-selected font-medium text-la-nube-selected dark:border-la-nube-secondary dark:text-la-nube-secondary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {e.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
