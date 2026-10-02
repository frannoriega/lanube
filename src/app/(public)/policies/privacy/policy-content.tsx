"use client";

import PrivacyPolicy from "@/assets/policies/privacy.mdx";
import { slugify } from "@/lib/utils/string";

/**
 * El MDX de la política, con componentes propios para los títulos. Es Client Component porque
 * `@next/mdx` (sin `mdx-components.tsx` en este repo) resuelve los componentes con un contexto
 * de React, que no existe en Server Components.
 *
 * - `h1`: se omite; el título lo pone el encabezado de la página.
 * - `h2`: lleva un `id` derivado del texto ("1. Identidad del Responsable" →
 *   `1-identidad-del-responsable`), que es lo que usan el índice y los enlaces `#…`.
 */
export function PolicyContent() {
  return (
    <PrivacyPolicy
      components={{
        h1: () => null,
        h2: ({ children }: { children?: React.ReactNode }) => (
          <h2 id={slugify(textOf(children))}>{children}</h2>
        ),
      }}
    />
  );
}

/** Texto plano de los hijos de un título MDX. */
function textOf(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number")
    return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  return "";
}
