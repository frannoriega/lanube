import "server-only";
import {
  subscribeLinks,
  userFeedPath,
  type UserFeedKind,
} from "@/lib/calendar/feed-token";
import { getSpacesByKind } from "@/lib/db/spaces";
import { hasPermission, type PermissionSet } from "@/lib/rbac";
import { absoluteUrl } from "@/lib/seo/metadata";

/** Un feed tal como lo muestra Configuración → «Calendario» (milestone 45). */
export interface UserFeedView {
  kind: UserFeedKind;
  name: string;
  description: string;
  /** Tiene datos de otras personas (los de espacio): la pantalla lo advierte. */
  sensitive: boolean;
  url: string;
  google: string;
  webcal: string;
}

/**
 * Los feeds a los que esta persona se puede suscribir: los propios y, con `reservations:manage`,
 * uno por espacio (sin «todo el edificio»: decisión del usuario). Las URLs llevan la firma de la
 * versión vigente.
 */
export async function userFeeds(
  registeredUserId: string,
  version: number,
  permissions: PermissionSet | null,
): Promise<UserFeedView[]> {
  const make = (
    kind: UserFeedKind,
    name: string,
    description: string,
    sensitive = false,
  ): UserFeedView => {
    const url = absoluteUrl(userFeedPath(registeredUserId, kind, version));
    return { kind, name, description, sensitive, url, ...subscribeLinks(url) };
  };
  const feeds = [
    make(
      "reservations",
      "Mis reservas",
      "Tus reservas, aprobadas y pendientes (las pendientes llevan ⏳).",
    ),
    make(
      "events",
      "Mis eventos",
      "Las sesiones de los eventos en los que estás inscripto.",
    ),
  ];
  if (hasPermission(permissions, "reservations:manage")) {
    for (const s of await getSpacesByKind("SPACE")) {
      feeds.push(
        make(
          `space-${s.id}`,
          s.name,
          `Todo lo que pasa en ${s.name}: reservas (con quién reservó), eventos y cierres.`,
          true,
        ),
      );
    }
  }
  return feeds;
}
