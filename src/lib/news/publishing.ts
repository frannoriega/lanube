/**
 * Reglas puras de publicación de Noticias — sin imports server-only, testeables directamente
 * (misma forma que `./transitions.ts`). `updateNewsPost` las compone con las escrituras.
 */

/**
 * ¿Esta grabación debe sellar `publishedAt`?
 *
 * Solo cuando la nota sale a la luz **por primera vez**. `publishedAt` significa "cuándo se
 * hizo pública por primera vez": ordena el feed y provee los segmentos de fecha de la URL
 * canónica.
 *
 * La regla anterior se basaba en la transición de estado (`status === PUBLISHED && existing
 * !== PUBLISHED`), que también se disparaba en `PAUSED -> PUBLISHED`. Restaurar un artículo
 * pausado lo volvía a sellar — lo mandaba al tope de /news, le cambiaba la URL y hacía que su
 * fecha de autoría mintiera (milestone-12 D9). `publishedAt == null` es lo que significa
 * "primera vez".
 */
export function shouldStampPublishedAt(
  inputStatus: string,
  existingPublishedAt: bigint | number | null,
): boolean {
  return inputStatus === "PUBLISHED" && existingPublishedAt == null;
}

/**
 * ¿Hay que retirar el slug actual de la nota a `news_post_slugs` (para que la URL vieja siga
 * resolviendo) antes de escribir el nuevo?
 *
 * Solo cuando el slug realmente cambia **y** la nota estuvo pública en algún momento: el slug
 * de un borrador nunca circuló, así que no hay link que preservar ni motivo para reservar esa
 * cadena frente a otras notas.
 */
export function shouldRetireSlug(
  nextSlug: string,
  existingSlug: string,
  existingPublishedAt: bigint | number | null,
): boolean {
  return nextSlug !== existingSlug && existingPublishedAt != null;
}

/**
 * ¿Hay que marcar la nota para que un admin la vuelva a revisar?
 *
 * Solo cuando un autor con `news:manage` a secas corrige una nota que ya está publicada y la
 * deja publicada (milestone-12 D20). La nota sigue en línea — una corrección no debería bajar
 * la página — y la marca es la forma en que el cambio igual llega a alguien que revise.
 *
 * Un autor con `news:approve` nunca la marca: su edición *es* la revisión. Tampoco la marca
 * ninguna grabación que no sea una corrección en el lugar, porque esas ya pasan por la
 * compuerta normal DRAFT -> PENDING_REVIEW -> PUBLISHED.
 *
 * Notar la asimetría con `assertAuthorTransition`: esa función decide si la grabación está
 * *permitida*, esta decide si necesita *seguimiento*. Están separadas a propósito, para que
 * ampliar una nunca amplíe la otra en silencio.
 */
export function shouldFlagForReview(
  inputStatus: string,
  existingStatus: string,
  canPublishDirectly: boolean,
): boolean {
  if (canPublishDirectly) return false;
  return inputStatus === "PUBLISHED" && existingStatus === "PUBLISHED";
}
