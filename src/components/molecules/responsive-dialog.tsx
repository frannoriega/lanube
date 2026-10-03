"use client";

/**
 * Diálogo responsive (milestone 14, Part B.1): un `Dialog` centrado desde `md` (≥ 768px)
 * y un `Drawer` inferior (vaul) por debajo.
 *
 * Por qué: en un teléfono un diálogo centrado con un formulario queda apretado, el teclado
 * lo tapa y el botón de confirmar suele quedar fuera de la vista. Una hoja que sube desde
 * abajo es el patrón nativo del teléfono: se alcanza con el pulgar, se cierra arrastrando
 * hacia abajo o tocando el fondo, y su pie (Guardar / Cancelar) queda pegado abajo
 * mientras el cuerpo scrollea.
 *
 * La API copia la de `ui/dialog.tsx` pieza por pieza (`ResponsiveDialog`,
 * `ResponsiveDialogContent`, `…Header`, `…Title`, `…Description`, `…Footer`, `…Close`,
 * `…Trigger`), así que migrar un diálogo existente es renombrar los componentes. La regla
 * de cuándo un formulario puede seguir en un diálogo (≤ ~4 campos simples, sin editores
 * ricos) está en `docs/milestones/milestones-14-mobile-redesign.md` y en CLAUDE.md; lo que
 * no la cumple va a una página propia.
 *
 * Detalle de implementación: la raíz decide el modo con `useMediaQuery` y lo comparte por
 * contexto, así cada pieza renderiza la variante Dialog o Drawer correspondiente sin que el
 * llamador tenga que saberlo.
 */

import * as React from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/** Breakpoint desde el cual se usa el diálogo centrado (= `md` de Tailwind). */
const DESKTOP_QUERY = "(min-width: 768px)";

const ResponsiveDialogContext = React.createContext<{ isDesktop: boolean }>({
  isDesktop: true,
});

function useResponsiveDialog() {
  return React.useContext(ResponsiveDialogContext);
}

type RootProps = {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
};

/**
 * Raíz. Acepta las mismas props controladas que `Dialog` (`open`, `onOpenChange`,
 * `defaultOpen`). En el servidor asume escritorio: los diálogos arrancan cerrados, así que
 * no hay salto visible al hidratar.
 */
function ResponsiveDialog({ children, ...props }: RootProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY, true);
  const ctx = React.useMemo(() => ({ isDesktop }), [isDesktop]);
  return (
    <ResponsiveDialogContext.Provider value={ctx}>
      {isDesktop ? (
        <Dialog {...props}>{children}</Dialog>
      ) : (
        <Drawer {...props}>{children}</Drawer>
      )}
    </ResponsiveDialogContext.Provider>
  );
}

function ResponsiveDialogTrigger(
  props: React.ComponentProps<typeof DialogTrigger>,
) {
  const { isDesktop } = useResponsiveDialog();
  return isDesktop ? (
    <DialogTrigger {...props} />
  ) : (
    <DrawerTrigger {...props} />
  );
}

function ResponsiveDialogClose(
  props: React.ComponentProps<typeof DialogClose>,
) {
  const { isDesktop } = useResponsiveDialog();
  return isDesktop ? <DialogClose {...props} /> : <DrawerClose {...props} />;
}

type ContentProps = React.ComponentProps<typeof DialogContent> & {
  /**
   * Clases solo para la variante Drawer. `className` se aplica únicamente al Dialog, porque
   * lo que suelen llevar (`sm:max-w-lg`, `max-h-[85vh] overflow-y-auto`, `p-0`) es tamaño
   * de diálogo centrado y no tiene sentido en una hoja de ancho completo.
   */
  drawerClassName?: string;
  /**
   * Abre el diálogo por encima de un `Sheet` (que vive en `z-[120]`, ver `ui/sheet.tsx`).
   * Hace falta cuando el diálogo se dispara desde un panel lateral abierto —p. ej. aprobar
   * una reserva desde su detalle—: con el `z-50` por defecto quedaba detrás del panel y el
   * botón de confirmar era inalcanzable. Sube overlay y contenido juntos, en ambos modos.
   */
  aboveSheet?: boolean;
};

/** Capa de un diálogo abierto desde un `Sheet`: justo por encima de su `z-[120]`. */
const ABOVE_SHEET_LAYER = "z-[130]";

/**
 * Contenido. En modo Drawer envuelve a los hijos en un área que scrollea (alto máximo 90dvh)
 * con el mismo `gap-4` que el Dialog, para que encabezado, campos y pie se vean igual en
 * ambos modos sin que el llamador agregue nada.
 */
function ResponsiveDialogContent({
  className,
  drawerClassName,
  children,
  showCloseButton,
  aboveSheet,
  ...props
}: ContentProps) {
  const { isDesktop } = useResponsiveDialog();
  const layer = aboveSheet ? ABOVE_SHEET_LAYER : undefined;
  if (isDesktop) {
    return (
      <DialogContent
        className={cn(layer, className)}
        overlayClassName={layer}
        showCloseButton={showCloseButton}
        {...props}
      >
        {children}
      </DialogContent>
    );
  }
  return (
    <DrawerContent
      className={cn("max-h-[90dvh]", layer, drawerClassName)}
      overlayClassName={layer}
      // `onOpenAutoFocus` & co. son props de Radix Dialog; vaul las acepta igual (usa Radix
      // por debajo), así que se pasan tal cual.
      {...(props as React.ComponentProps<typeof DrawerContent>)}
    >
      <div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </DrawerContent>
  );
}

function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { isDesktop } = useResponsiveDialog();
  if (isDesktop) return <DialogHeader className={className} {...props} />;
  // En la hoja, encabezado alineado a la izquierda (como el resto de los formularios) y
  // con aire arriba para separarlo del "tirador" de vaul.
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-1.5 pt-4 text-left", className)}
      {...props}
    />
  );
}

/**
 * Pie con las acciones. En la hoja queda pegado abajo (`sticky`) sobre el fondo, así que
 * Guardar / Cancelar se alcanzan aunque el formulario sea más alto que la pantalla. Los
 * botones se apilan a lo ancho, con la acción principal arriba (igual que el Dialog en
 * pantallas chicas: `flex-col-reverse`).
 */
function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { isDesktop } = useResponsiveDialog();
  if (isDesktop) return <DialogFooter className={className} {...props} />;
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        // El `-mb` anula el padding inferior del área que scrollea (ver `…Content`) y el `pb`
        // lo repone dentro del pie: sin esto quedaba una franja bajo el pie por donde se veía
        // pasar el contenido al scrollear.
        "sticky bottom-0 -mx-4 -mb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col-reverse gap-2 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    />
  );
}

function ResponsiveDialogTitle(
  props: React.ComponentProps<typeof DialogTitle>,
) {
  const { isDesktop } = useResponsiveDialog();
  return isDesktop ? (
    <DialogTitle {...props} />
  ) : (
    <DrawerTitle
      {...props}
      className={cn("text-lg leading-none", props.className)}
    />
  );
}

function ResponsiveDialogDescription(
  props: React.ComponentProps<typeof DialogDescription>,
) {
  const { isDesktop } = useResponsiveDialog();
  return isDesktop ? (
    <DialogDescription {...props} />
  ) : (
    <DrawerDescription {...props} />
  );
}

export {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
};
