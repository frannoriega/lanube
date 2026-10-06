import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { aboutAsMarkdown } from "@/lib/about/content";
import { todayDateKeyInAdminTz } from "@/lib/admin/admin-timezone";
import { closureWindowLabel } from "@/lib/closed-days/closures";
import { nowMs } from "@/lib/clock";
import { getUpcomingClosures } from "@/lib/db/closedDays";
import { getSiteConfig } from "@/lib/db/siteConfig";
import { currentVersion } from "@/lib/policies/pending";
import {
  getPolicyBySlug,
  POLICIES,
  POLICY_KEYS,
} from "@/lib/policies/registry";
import { readPolicyMarkdown } from "@/lib/policies/source";
import { defineTool, fail, ok, type McpToolContext } from "./shared";

/**
 * Información **pública** de La Nube para cualquier cuenta conectada (milestone 21): los datos
 * de contacto (los mismos que muestra el sitio), las políticas vigentes y "Quiénes somos".
 *
 * No piden scope ni permiso, y funcionan aunque la cuenta esté bloqueada: quien tiene
 * políticas pendientes tiene que poder leerlas. Es información que ya está publicada en la web.
 */
export function registerPublicTools(
  server: McpServer,
  ctx: McpToolContext,
): void {
  defineTool(
    server,
    ctx,
    "get_contact_info",
    {
      title: "Datos de contacto",
      description:
        "Los datos de contacto públicos de La Nube (dirección, email, teléfono, redes), los mismos que muestra el sitio, y los próximos días cerrados (feriados, vacaciones, cierres por horario) con su motivo.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const [c, closures] = await Promise.all([
        getSiteConfig(),
        getUpcomingClosures(todayDateKeyInAdminTz(nowMs())),
      ]);
      return ok({
        address: { text: c.addressText, map_url: c.addressUrl },
        email: c.email,
        phone: { text: c.phoneText, dial: c.phoneClickable },
        instagram: { handle: c.instagramText, url: c.instagramUrl },
        github: { name: c.githubText, url: c.githubUrl },
        website: ctx.origin,
        // Cierres próximos (feriados, vacaciones, cierres por horario): para responder
        // «¿está abierto el viernes?» sin tener que consultar la disponibilidad de un espacio.
        upcoming_closures: closures.map((cl) => ({
          from: cl.startDate,
          to: cl.endDate,
          hours: closureWindowLabel(cl),
          reason: cl.title,
        })),
      });
    },
  );

  defineTool(
    server,
    ctx,
    "list_policies",
    {
      title: "Listar políticas",
      description:
        "Las políticas de La Nube (privacidad, etc.) con su versión vigente y su link público. Para leer el texto, get_policy.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const at = nowMs();
      return ok({
        policies: POLICY_KEYS.map((key) => {
          const p = POLICIES[key];
          const cur = currentVersion(p, at);
          return {
            slug: p.slug,
            title: p.title,
            description: p.description,
            current_version: cur?.version ?? null,
            effective_since: cur?.effectiveAt ?? null,
            url: `${ctx.origin}/policies/${p.slug}`,
            versions: p.versions.map((v) => v.version),
          };
        }),
      });
    },
  );

  defineTool(
    server,
    ctx,
    "get_policy",
    {
      title: "Leer una política",
      description:
        "El texto completo (markdown) de una política: la versión vigente, o una anterior si se indica version.",
      inputSchema: z.object({
        slug: z.string().describe("Slug de la política (de list_policies)"),
        version: z
          .string()
          .optional()
          .describe("Versión puntual (YYYY-MM-DD). Por defecto, la vigente."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const found = getPolicyBySlug(args.slug);
      if (!found) return fail("Política no encontrada");
      const version =
        args.version ?? currentVersion(found.policy, nowMs())?.version;
      if (!version)
        return fail("Esta política todavía no tiene versión vigente");
      // Una versión futura (cargada pero todavía no vigente) no se adelanta.
      const versions = found.policy.versions;
      const v = versions.find((x) => x.version === version);
      const cur = currentVersion(found.policy, nowMs());
      const curIndex = cur ? versions.indexOf(cur) : -1;
      if (!v || versions.indexOf(v) > curIndex)
        return fail("Esa versión no existe o todavía no rige");
      const markdown = await readPolicyMarkdown(found.policy, version);
      if (!markdown) return fail("No pudimos leer el texto de la política");
      return ok({
        title: found.policy.title,
        version,
        effective_since: v.effectiveAt,
        is_current: v.version === cur?.version,
        url: `${ctx.origin}/policies/${found.policy.slug}`,
        markdown,
      });
    },
  );

  defineTool(
    server,
    ctx,
    "get_about",
    {
      title: "Quiénes somos",
      description:
        "Qué es La Nube (Polo Tecnológico de Concepción del Uruguay): historia, desafío, ecosistema, plan 2026–2030, misión, visión y valores. Es el contenido de la página «Quiénes somos».",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => ok({ url: `${ctx.origin}/about`, markdown: aboutAsMarkdown() }),
  );
}
