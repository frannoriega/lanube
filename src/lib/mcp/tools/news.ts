import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  getNewsPostById,
  listAdminNewsPosts,
  type NewsPost,
} from "@/lib/db/news";
import {
  createAssistantNewsDraft,
  updateAssistantNewsDraft,
} from "@/lib/news/assistant-drafts";
import { authorDisplayName, newsDetailPath } from "@/lib/news/url";
import { hasPermission } from "@/lib/rbac";
import { toVenueIso } from "../format";
import { defineTool, fail, ok, pageArgs, type McpToolContext } from "./shared";

/**
 * Noticias desde el asistente (milestone 21): **leer, revisar y redactar borradores**.
 *
 * - **Leer**: quien tiene `news:approve` ve todas las notas; quien solo tiene `news:manage`,
 *   las propias — el mismo alcance que `GET /api/admin/news`.
 * - **Revisar**: el asistente lee las notas enviadas a revisión y las solicitudes de cambio
 *   sobre notas publicadas (con el contenido propuesto) y da su opinión **en el chat**. La
 *   decisión (aprobar/rechazar) **no** es una tool: aprobar publica, y publicar lo hace siempre
 *   una persona en el panel. Las respuestas traen el link para decidir.
 * - **Redactar**: solo borradores (`create_news_draft` / `update_news_draft`), con vista previa
 *   y confirmación explícita antes, y el link al borrador después. Ver
 *   `src/lib/news/assistant-drafts.ts`.
 */

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_REVIEW: "Pendiente de revisión",
  PUBLISHED: "Publicada",
  REJECTED: "Rechazada",
  PAUSED: "Pausada",
};

const PENDING_ACTION_LABELS: Record<string, string> = {
  EDIT: "pidió editarla",
  PAUSE: "pidió pausarla",
  DELETE: "pidió eliminarla",
};

const iso = (ms: bigint | null) => (ms == null ? null : toVenueIso(Number(ms)));

function summaryOf(ctx: McpToolContext, p: NewsPost) {
  return {
    id: p.id,
    title: p.title,
    summary: p.summary,
    status: p.status,
    status_label: STATUS_LABELS[p.status] ?? p.status,
    pending_request: p.pendingAction
      ? (PENDING_ACTION_LABELS[p.pendingAction] ?? p.pendingAction)
      : null,
    author: authorDisplayName(p.authorLabel),
    has_cover_image: !!p.coverImageUrl,
    featured: p.isFeatured,
    created_at: iso(p.createdAt),
    published_at: iso(p.publishedAt),
    admin_url: `${ctx.origin}/admin/news/${p.id}`,
    public_url:
      p.status === "PUBLISHED" ? `${ctx.origin}${newsDetailPath(p)}` : null,
  };
}

const CONFIRMATION_HINT =
  "Antes de llamarla, mostrale a la persona la vista previa completa (título, resumen y cuerpo en markdown, tal como se van a guardar) y pedile confirmación explícita; poné confirmed_by_user en true solo si dijo que sí a esa versión exacta.";

export function registerNewsTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  const canApprove = hasPermission(ctx.permissions, "news:approve");

  defineTool(
    server,
    ctx,
    "list_news",
    {
      title: "Listar noticias",
      description: `Lista las notas de Noticias del panel, las más nuevas primero. ${
        canApprove ? "Ves las de todas las personas." : "Ves solo las tuyas."
      } Para revisar: status=PENDING_REVIEW (enviadas a revisión) o pending_requests_only=true (cambios pedidos sobre notas publicadas).`,
      inputSchema: z.object({
        status: z
          .enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "PAUSED"])
          .optional()
          .describe("Filtrar por estado"),
        pending_requests_only: z
          .boolean()
          .optional()
          .describe(
            "Solo notas publicadas con un pedido de edición, pausa o eliminación",
          ),
        page: z.number().int().min(1).optional(),
        page_size: z.number().int().min(1).max(50).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args, user) => {
      const { page, pageSize } = pageArgs(args.page, args.page_size);
      const { items, total } = await listAdminNewsPosts({
        authorId: canApprove ? undefined : user.registeredUserId,
        status: args.status,
        hasPendingAction: args.pending_requests_only,
        page,
        pageSize,
      });
      return ok({
        total,
        page,
        page_size: pageSize,
        posts: items.map((p) => summaryOf(ctx, p)),
      });
    },
  );

  defineTool(
    server,
    ctx,
    "get_news_post",
    {
      title: "Leer una noticia",
      description:
        "Una nota completa: cuerpo en markdown, estado, motivo de la última decisión y, si hay un pedido de edición pendiente, el contenido propuesto. Sirve para revisarla y opinar; aprobar o rechazar se hace desde el panel (admin_url), no con una tool.",
      inputSchema: z.object({
        id: z.string().describe("Id de la nota (de list_news)"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args, user) => {
      const p = await getNewsPostById(args.id);
      if (
        !p ||
        p.deletedAt != null ||
        (!canApprove && p.authorId !== user.registeredUserId)
      )
        return fail("Nota no encontrada");
      return ok({
        ...summaryOf(ctx, p),
        body_markdown: p.body,
        last_decision: p.decidedAt
          ? { at: iso(p.decidedAt), reason: p.decisionReason }
          : null,
        pending_request: p.pendingAction
          ? {
              action: p.pendingAction,
              label: PENDING_ACTION_LABELS[p.pendingAction] ?? p.pendingAction,
              reason: p.pendingReason,
              requested_at: iso(p.pendingRequestedAt),
              proposed:
                p.pendingAction === "EDIT"
                  ? {
                      title: p.pendingTitle,
                      summary: p.pendingSummary,
                      body_markdown: p.pendingBody,
                    }
                  : null,
            }
          : null,
        can_decide_in_panel: canApprove,
      });
    },
  );

  defineTool(
    server,
    ctx,
    "create_news_draft",
    {
      title: "Crear un borrador de noticia",
      description: `Crea un BORRADOR de nota a nombre de la persona. Nunca publica ni envía a revisión: devuelve el link al borrador en el panel, donde la persona agrega la imagen de portada, lo revisa y lo publica (o lo envía a revisión). ${CONFIRMATION_HINT}`,
      inputSchema: z.object({
        title: z
          .string()
          .min(1)
          .max(160)
          .describe("Título (hasta 160 caracteres)"),
        summary: z
          .string()
          .min(1)
          .max(200)
          .describe(
            "Resumen en texto plano para las tarjetas (hasta 200 caracteres, sin markdown)",
          ),
        body: z
          .string()
          .min(1)
          .max(20000)
          .describe("Cuerpo en markdown (sin HTML)"),
        confirmed_by_user: z
          .literal(true)
          .describe(
            "true solo si la persona vio la vista previa y confirmó explícitamente",
          ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args, user) => {
      const post = await createAssistantNewsDraft(
        user.registeredUserId,
        { title: args.title, summary: args.summary, body: args.body },
        ctx.token.clientName,
      );
      return ok({
        id: post.id,
        status: post.status,
        status_label: STATUS_LABELS[post.status],
        draft_url: `${ctx.origin}/admin/news/${post.id}`,
        next_steps:
          "El borrador no es público. Para publicarlo, la persona tiene que abrir draft_url, agregar la imagen de portada (obligatoria), revisarlo y publicarlo o enviarlo a revisión desde el panel.",
      });
    },
  );

  defineTool(
    server,
    ctx,
    "update_news_draft",
    {
      title: "Editar un borrador de noticia",
      description: `Reescribe título, resumen y/o cuerpo de un borrador (o de una nota rechazada, que vuelve a borrador). No sirve para notas enviadas a revisión, publicadas o pausadas: eso se cambia desde el panel. Nunca publica. ${CONFIRMATION_HINT}`,
      inputSchema: z.object({
        id: z.string().describe("Id de la nota (de list_news)"),
        title: z.string().min(1).max(160).optional(),
        summary: z.string().min(1).max(200).optional(),
        body: z.string().min(1).max(20000).optional(),
        confirmed_by_user: z
          .literal(true)
          .describe(
            "true solo si la persona vio la vista previa y confirmó explícitamente",
          ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args, user) => {
      if (!args.title && !args.summary && !args.body)
        return fail(
          "No hay nada para cambiar: mandá título, resumen o cuerpo.",
        );
      const post = await updateAssistantNewsDraft(
        user.registeredUserId,
        canApprove,
        args.id,
        { title: args.title, summary: args.summary, body: args.body },
        ctx.token.clientName,
      );
      return ok({
        id: post.id,
        status: post.status,
        status_label: STATUS_LABELS[post.status],
        draft_url: `${ctx.origin}/admin/news/${post.id}`,
        next_steps:
          "Sigue siendo un borrador no público: la persona lo termina, le agrega la portada si falta y lo publica o envía a revisión desde draft_url.",
      });
    },
  );
}
