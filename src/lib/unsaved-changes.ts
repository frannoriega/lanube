/**
 * Lógica pura del guardia de "cambios sin guardar" (milestone 14), separada del hook para
 * poder testearla sin DOM (`unsaved-changes.test.ts`).
 */

/** Lo mínimo de un click que importa para decidir si hay que interceptarlo. */
export interface LinkClick {
  /** `href` absoluto del `<a>` (o `null` si no es un link). */
  href: string | null;
  target: string | null;
  hasDownload: boolean;
  /** Botón del mouse (0 = principal). */
  button: number;
  /** Ctrl/Cmd/Shift/Alt: el usuario está abriendo en otra pestaña/ventana. */
  modified: boolean;
  defaultPrevented: boolean;
}

/**
 * ¿Este click en un link navega *fuera* del formulario dentro de la misma pestaña? Solo
 * esos se interceptan para preguntar antes de descartar cambios. No se interceptan: links
 * a otra pestaña o con modificadores, descargas, otros orígenes (los cubre `beforeunload`),
 * anclas dentro de la misma página (el índice de secciones) ni clicks ya cancelados.
 */
export function shouldInterceptLink(
  click: LinkClick,
  currentUrl: string,
): boolean {
  if (!click.href || click.defaultPrevented) return false;
  if (click.button !== 0 || click.modified) return false;
  if (click.hasDownload) return false;
  if (click.target && click.target !== "_self") return false;
  let to: URL;
  let from: URL;
  try {
    to = new URL(click.href, currentUrl);
    from = new URL(currentUrl);
  } catch {
    return false;
  }
  if (to.origin !== from.origin) return false;
  // Mismo documento, solo cambia el hash: es un salto dentro del formulario.
  if (to.pathname === from.pathname && to.search === from.search) return false;
  return true;
}
