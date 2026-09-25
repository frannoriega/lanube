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
 * ¿Una nota que se está por eliminar debe ser un soft delete (`deletedAt`) en lugar de un
 * `DELETE` físico de la fila?
 *
 * Mismo criterio que `shouldRetireSlug`: si estuvo pública alguna vez, su slug puede tener
 * links entrando y su fila puede tener historia (`NewsPostSlug`, decisiones, autoría) que vale
 * conservar — igual que `Event.deletedAt`. Una nota que nunca salió a la luz (DRAFT/REJECTED
 * sin `publishedAt`) no tiene nada de eso que preservar, así que se borra de verdad.
 */
export function shouldSoftDelete(
  existingPublishedAt: bigint | number | null,
): boolean {
  return existingPublishedAt != null;
}
