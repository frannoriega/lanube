import "server-only";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { actorLabelFor } from "@/lib/audit/diff";
import { beginAudit } from "@/lib/audit/emit";
import {
  createNewsPost,
  getNewsPostById,
  updateNewsPost,
  type NewsPost,
} from "@/lib/db/news";
import { DomainError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { newsPostInputSchema, type NewsPostInput } from "@/lib/schemas/news";

/**
 * Borradores de Noticias escritos por un asistente conectado por MCP (milestone 21).
 *
 * La regla del pedido: el asistente **redacta, nunca publica**. Por eso todo lo que escribe
 * queda en `DRAFT`, que no se ve en ningún lado público, y la persona lo termina en el panel:
 * agrega la imagen de portada (el asistente no sube imágenes, y la portada es obligatoria
 * para guardar desde el formulario), revisa, y publica o envía a revisión con sus propios
 * permisos. Así el paso que expone algo al público siempre lo da un humano en la web.
 *
 * Reglas:
 * - Crear: cualquier cuenta con `news:manage` (el conector lo chequea antes).
 * - Editar: solo notas en `DRAFT` o `REJECTED` (una rechazada vuelve a `DRAFT` al
 *   reescribirla). Nunca una enviada a revisión, publicada o pausada: eso ya está en manos
 *   de otra persona o es público. Y solo las propias, salvo quien tiene `news:approve`, que en
 *   la web también puede editar las de otros.
 * - El slug, la portada y "destacada" no se tocan: el asistente solo escribe título, resumen
 *   y cuerpo.
 * - Todo pasa por la auditoría como si lo hubiera hecho la persona, con el contexto
 *   «Vía: Asistente: <nombre>».
 */

/** Lo que el asistente puede escribir: mismos límites que el formulario de la web. */
export const assistantDraftSchema = newsPostInputSchema.pick({
  title: true,
  summary: true,
  body: true,
});
export type AssistantDraftInput = Pick<
  NewsPostInput,
  "title" | "summary" | "body"
>;

const EDITABLE_STATUSES = new Set(["DRAFT", "REJECTED"]);

function parseDraft(input: AssistantDraftInput): AssistantDraftInput {
  const parsed = assistantDraftSchema.safeParse(input);
  if (!parsed.success)
    throw new DomainError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  return parsed.data;
}

async function actorLabel(registeredUserId: string): Promise<string> {
  const actor = await prisma.registeredUser.findUnique({
    where: { id: registeredUserId },
    select: {
      name: true,
      lastName: true,
      user: { select: { email: true, displayEmail: true } },
    },
  });
  return actor ? actorLabelFor(actor) : `(usuario ${registeredUserId})`;
}

export async function createAssistantNewsDraft(
  registeredUserId: string,
  input: AssistantDraftInput,
  clientName: string,
): Promise<NewsPost> {
  const data = parseDraft(input);
  const audit = await beginAudit("NewsPost", null);
  const post = await createNewsPost(
    {
      ...data,
      slug: "", // se deriva del título (`uniqueSlugFor`)
      // Sin portada: la agrega la persona en el panel. La columna es nullable.
      coverImageUrl: undefined as unknown as string,
      isFeatured: false,
      status: "DRAFT",
    },
    { id: registeredUserId, label: await actorLabel(registeredUserId) },
    false,
  );
  await audit.commit({ userId: registeredUserId }, AUDIT_ACTIONS.newsCreate, {
    entityId: post.id,
    context: { Vía: `Asistente: ${clientName}` },
  });
  return post;
}

export async function updateAssistantNewsDraft(
  registeredUserId: string,
  canApprove: boolean,
  id: string,
  patch: Partial<AssistantDraftInput>,
  clientName: string,
): Promise<NewsPost> {
  const existing = await getNewsPostById(id);
  if (!existing || existing.deletedAt != null)
    throw new DomainError("Nota no encontrada", 404);
  // Una nota ajena responde igual que una inexistente para quien no puede verla.
  if (!canApprove && existing.authorId !== registeredUserId)
    throw new DomainError("Nota no encontrada", 404);
  if (!EDITABLE_STATUSES.has(existing.status))
    throw new DomainError(
      "El asistente solo puede editar borradores o notas rechazadas. Esta nota ya está en revisión, publicada o pausada: cualquier cambio se hace desde el panel.",
      409,
    );

  const data = parseDraft({
    title: patch.title ?? existing.title,
    summary: patch.summary ?? existing.summary,
    body: patch.body ?? existing.body,
  });
  const audit = await beginAudit("NewsPost", id);
  const post = await updateNewsPost(
    id,
    {
      ...data,
      slug: existing.slug, // estable: el asistente no renombra URLs
      coverImageUrl: existing.coverImageUrl as string,
      isFeatured: existing.isFeatured,
      featuredOrder: undefined,
      status: "DRAFT",
    },
    false,
  );
  await audit.commit({ userId: registeredUserId }, AUDIT_ACTIONS.newsUpdate, {
    context: { Vía: `Asistente: ${clientName}` },
  });
  return post;
}
