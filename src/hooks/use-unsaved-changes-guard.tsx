"use client";

/**
 * Guardia de "cambios sin guardar" para formularios de página (milestone 14, Part B.4).
 * No existía en ningún formulario: salir de un evento a medio editar perdía todo en silencio.
 *
 * Cubre los dos caminos de salida que se pueden interceptar de forma confiable:
 *   1. **Recargar / cerrar la pestaña / ir a otro sitio** → `beforeunload` (el navegador
 *      muestra su propio diálogo; el texto no se puede personalizar).
 *   2. **Navegación dentro de la app** (sidebar, breadcrumbs, cualquier `<Link>`) → se
 *      escuchan los clicks en fase de captura; si el destino sale del formulario
 *      (`shouldInterceptLink`) se cancela y se pregunta con `UnsavedChangesDialog`. Si la
 *      persona confirma, se navega con `router.push`.
 *
 * Limitación conocida: el botón "atrás" del navegador/teléfono no se intercepta (el App
 * Router no expone un evento cancelable para eso). Queda cubierto solo si sale del sitio.
 *
 * Uso:
 *   const guard = useUnsavedChangesGuard(form.formState.isDirty && !saving);
 *   …
 *   <UnsavedChangesDialog guard={guard} />
 */

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/molecules/responsive-dialog";
import { Button } from "@/components/ui/button";
import { shouldInterceptLink } from "@/lib/unsaved-changes";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UnsavedChangesGuard {
  /** Destino pendiente de confirmación (o `null` si no hay diálogo abierto). */
  pendingHref: string | null;
  /** Descarta los cambios y navega al destino pendiente. */
  confirm: () => void;
  /** Cierra el diálogo y se queda en el formulario. */
  cancel: () => void;
  /**
   * Desactiva el guardia para la próxima navegación (p. ej. justo antes de redirigir tras
   * guardar con éxito, cuando `isDirty` todavía no se actualizó).
   */
  release: () => void;
}

export function useUnsavedChangesGuard(dirty: boolean): UnsavedChangesGuard {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const releasedRef = useRef(false);
  // `releasedRef` se consulta dentro de cada handler (no en el render): `release()` no
  // re-renderiza, y tiene que surtir efecto para la navegación inmediatamente siguiente.
  const active = dirty;

  // 1. Recargar / cerrar / salir del sitio.
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (releasedRef.current) return;
      e.preventDefault();
      // Requerido por algunos navegadores para mostrar el diálogo.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  // 2. Links internos (captura: antes de que el <Link> de Next haga su push).
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      if (releasedRef.current) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const intercept = shouldInterceptLink(
        {
          href: anchor.href || null,
          target: anchor.getAttribute("target"),
          hasDownload: anchor.hasAttribute("download"),
          button: e.button,
          modified: e.metaKey || e.ctrlKey || e.shiftKey || e.altKey,
          defaultPrevented: e.defaultPrevented,
        },
        window.location.href,
      );
      if (!intercept) return;
      e.preventDefault();
      e.stopPropagation();
      const url = new URL(anchor.href);
      setPendingHref(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active]);

  const confirm = useCallback(() => {
    const href = pendingHref;
    releasedRef.current = true;
    setPendingHref(null);
    if (href) router.push(href);
  }, [pendingHref, router]);

  const cancel = useCallback(() => setPendingHref(null), []);
  const release = useCallback(() => {
    releasedRef.current = true;
  }, []);

  return { pendingHref, confirm, cancel, release };
}

/** Diálogo (drawer en el teléfono) que pregunta antes de descartar los cambios. */
export function UnsavedChangesDialog({
  guard,
}: {
  guard: UnsavedChangesGuard;
}) {
  return (
    <ResponsiveDialog
      open={guard.pendingHref !== null}
      onOpenChange={(open) => !open && guard.cancel()}
    >
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>¿Salir sin guardar?</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Tenés cambios que todavía no guardaste. Si salís ahora, se pierden.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button type="button" variant="outline" onClick={guard.cancel}>
            Seguir editando
          </Button>
          <Button type="button" variant="destructive" onClick={guard.confirm}>
            Descartar cambios
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
