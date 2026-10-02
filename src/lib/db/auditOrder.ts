import "server-only";
import { prisma } from "@/lib/prisma";
import type { OrderEntry } from "@/lib/audit/humanize";

/**
 * Fotos del orden de las listas reordenables ("Reordenar", milestone 14), para la auditoría.
 *
 * Por qué existe: las entradas `*.reorder` / `*.featuredReorder` solo guardaban
 * `after: { orderedIds }` — una lista de cuid2 sin el orden anterior. En `/admin/audit` eso
 * se leía como "se agregaron estos ids" y no había forma humana de entender qué se movió.
 * Ahora cada ruta de reordenamiento guarda `before/after: { order: [{ id, name }] }`, con el
 * nombre tal como era en ese momento (si después se renombra o borra el registro, la entrada
 * sigue contando lo que pasó).
 *
 * La clave del mapa es el `entityType` con el que se audita cada reordenamiento; cada loader
 * devuelve la lista en el mismo orden en que la muestra el panel de administración.
 */
const ORDER_LOADERS: Record<string, () => Promise<OrderEntry[]>> = {
  Space: () =>
    prisma.space.findMany({
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
  ReservationType: () =>
    prisma.reservationType.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  // Mismo orden que `listLandingThemes`: la prioridad más alta arriba (arriba gana).
  LandingTheme: () =>
    prisma.landingTheme.findMany({
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true },
    }),
  // Solo los destacados: es lo único que ordena "Reordenar destacados" (ver `listFeaturedEvents`).
  Event: () =>
    prisma.event.findMany({
      where: { isFeatured: true, deletedAt: null },
      orderBy: [{ featuredOrder: "asc" }, { startTime: "desc" }],
      select: { id: true, name: true },
    }),
  NewsPost: async () =>
    (
      await prisma.newsPost.findMany({
        where: { isFeatured: true, deletedAt: null },
        orderBy: [{ featuredOrder: "asc" }, { createdAt: "desc" }],
        select: { id: true, title: true },
      })
    ).map((p) => ({ id: p.id, name: p.title })),
};

/**
 * Orden actual de la lista reordenable de `entityType`, con nombres. Las rutas de
 * reordenamiento lo llaman antes y después de escribir, y guardan ambas fotos en la entrada
 * de auditoría (la de "después" se lee de la base, no del pedido, así refleja lo que
 * realmente quedó — p. ej. un evento des-destacado mientras tanto no aparece).
 */
export async function snapshotOrder(entityType: string): Promise<OrderEntry[]> {
  const load = ORDER_LOADERS[entityType];
  if (!load) throw new Error(`Sin orden auditable para ${entityType}`);
  return load();
}

/**
 * Para entradas de auditoría escritas antes de las fotos con nombre (solo traen
 * `orderedIds`): resuelve los ids a sus nombres **actuales**. Un id que ya no existe queda
 * fuera del mapa y la UI lo muestra como "(eliminado)". Devuelve `{}` para tipos de entidad
 * que no son reordenables.
 */
export async function resolveOrderNames(
  entityType: string,
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const where = { id: { in: ids } };
  const select = { id: true, name: true } as const;
  let rows: OrderEntry[] = [];
  switch (entityType) {
    case "Space":
      rows = await prisma.space.findMany({ where, select });
      break;
    case "ReservationType":
      rows = await prisma.reservationType.findMany({ where, select });
      break;
    case "LandingTheme":
      rows = await prisma.landingTheme.findMany({ where, select });
      break;
    case "Event":
      rows = await prisma.event.findMany({ where, select });
      break;
    case "NewsPost":
      rows = (
        await prisma.newsPost.findMany({
          where,
          select: { id: true, title: true },
        })
      ).map((p) => ({ id: p.id, name: p.title }));
      break;
    default:
      return {};
  }
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
