import { absoluteUrl } from "@/lib/seo/metadata";
import type { MetadataRoute } from "next";

/**
 * `robots.txt` (milestone 41). Se rastrea el sitio público; se excluye todo lo que pide sesión o
 * no tiene sentido en un buscador. `/forms/response` va aparte porque esos enlaces son
 * credenciales (milestone 25, S5): aunque nadie los publique, que ningún buscador los siga.
 * Excluir de `robots.txt` no esconde nada (lo que es privado lo protege la sesión); solo evita
 * que un buscador gaste rastreo o muestre pantallas de ingreso.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/user",
        "/api",
        "/auth",
        "/oauth",
        "/forms/response",
        "/policies/accept",
        "/banned",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
