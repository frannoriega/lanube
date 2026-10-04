"use client";

import dynamic from "next/dynamic";
import type { MDXProps } from "mdx/types";
import type { ComponentType } from "react";
import { slugify } from "@/lib/utils/string";

/** Un componente MDX compilado por `@next/mdx`. */
type MdxComponent = ComponentType<MDXProps>;

/**
 * El MDX de cada versión de cada política, por su ruta en el registro (`registry.ts`,
 * campo `file`). **Next necesita un `import` estático por archivo**, así que agregar una
 * versión al registro implica agregar su línea acá — `registry.test.ts` falla si falta.
 *
 * Cada versión se carga con `next/dynamic` (se sigue renderizando en el servidor): así el
 * bundle de una página no arrastra el texto de todas las versiones archivadas.
 */
const POLICY_CONTENT: Record<string, MdxComponent> = {
  "privacy/2025-11-16.mdx": dynamic(
    () => import("@/assets/policies/privacy/2025-11-16.mdx"),
  ),
};

/**
 * El texto de una versión de una política, con componentes propios para los títulos. Es
 * Client Component porque `@next/mdx` (sin `mdx-components.tsx` en este repo) resuelve los
 * componentes con un contexto de React, que no existe en Server Components.
 *
 * - `h1`: se omite; el título lo pone el encabezado de la página.
 * - `h2`: lleva un `id` derivado del texto ("1. Identidad del Responsable" →
 *   `1-identidad-del-responsable`), que es lo que usan el índice y los enlaces `#…`.
 */
export function PolicyContent({ file }: { file: string }) {
  const Content = POLICY_CONTENT[file];
  if (!Content) return null;
  return (
    <Content
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
