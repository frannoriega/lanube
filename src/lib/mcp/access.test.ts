import { describe, expect, it } from "vitest";
import { OAUTH_SCOPES } from "@/lib/oauth/config";
import type { Permission, PermissionSet } from "@/lib/rbac";
import {
  canUseTool,
  FORBIDDEN_PERMISSIONS,
  type McpToolName,
  scopeAppliesTo,
  TOOL_ACCESS,
} from "./access";

const ALL_TOOLS = Object.keys(TOOL_ACCESS) as McpToolName[];
const ALL_SCOPES = [...OAUTH_SCOPES];

const set = (...permissions: Permission[]): PermissionSet => ({
  isSuperadmin: false,
  permissions,
});
const SUPERADMIN: PermissionSet = { isSuperadmin: true, permissions: [] };

const usable = (scopes: string[], perms: PermissionSet | null) =>
  ALL_TOOLS.filter((t) => canUseTool(t, scopes, perms)).sort();

const PUBLIC = ["get_about", "get_contact_info", "get_policy", "list_policies"];
const RESERVATIONS = [
  "cancel_reservation",
  "get_availability",
  "list_my_reservations",
  "list_spaces",
  "request_reservation",
];

describe("TOOL_ACCESS", () => {
  it("ninguna tool expone lo que el usuario dejó afuera del conector", () => {
    // Auditoría, tipos de reserva, espacios, contacto (su edición), roles y temas.
    for (const name of ALL_TOOLS) {
      for (const p of TOOL_ACCESS[name].anyOf ?? []) {
        expect(FORBIDDEN_PERMISSIONS, `${name} pide ${p}`).not.toContain(p);
      }
    }
  });

  it("toda tool que pide un permiso de gestión pide también un scope de gestión", () => {
    for (const name of ALL_TOOLS) {
      const a = TOOL_ACCESS[name];
      if (a.anyOf)
        expect(["management:read", "news:write"], name).toContain(a.scope);
    }
  });

  it("las únicas tools que escriben son las de reservas propias y los borradores", () => {
    const writes = ALL_TOOLS.filter((t) =>
      ["reservations:write", "news:write"].includes(TOOL_ACCESS[t].scope ?? ""),
    ).sort();
    expect(writes).toEqual([
      "cancel_reservation",
      "create_news_draft",
      "request_reservation",
      "update_news_draft",
    ]);
  });
});

describe("canUseTool", () => {
  it("una cuenta sin permisos de gestión: lo público y sus reservas", () => {
    expect(usable(ALL_SCOPES, set())).toEqual(
      [...PUBLIC, ...RESERVATIONS].sort(),
    );
  });

  it("una cuenta bloqueada (sin permisos resueltos) no ve gestión aunque sea admin", () => {
    expect(usable(ALL_SCOPES, null)).toEqual(
      [...PUBLIC, ...RESERVATIONS].sort(),
    );
  });

  it("lo público no depende de ningún scope", () => {
    expect(usable([], set())).toEqual(PUBLIC);
  });

  it("Comunicador (news:manage): noticias completas, nada más de gestión", () => {
    expect(usable(ALL_SCOPES, set("admin:access", "news:manage"))).toEqual(
      [
        ...PUBLIC,
        ...RESERVATIONS,
        "create_news_draft",
        "get_news_post",
        "list_news",
        "update_news_draft",
      ].sort(),
    );
  });

  it("news:approve sin news:manage: lee y revisa, pero no redacta", () => {
    const tools = usable(ALL_SCOPES, set("news:approve"));
    expect(tools).toContain("list_news");
    expect(tools).toContain("get_news_post");
    expect(tools).not.toContain("create_news_draft");
  });

  it("cada permiso habilita solo su área", () => {
    expect(usable(ALL_SCOPES, set("events:manage"))).toEqual(
      [
        ...PUBLIC,
        ...RESERVATIONS,
        "get_event",
        "list_event_participants",
        "list_events",
      ].sort(),
    );
    expect(usable(ALL_SCOPES, set("reports:view"))).toContain(
      "get_usage_report",
    );
    expect(usable(ALL_SCOPES, set("reports:view"))).not.toContain(
      "list_events",
    );
    expect(usable(ALL_SCOPES, set("resources:manage"))).toContain(
      "get_resource",
    );
    expect(usable(ALL_SCOPES, set("forms:manage"))).toContain(
      "get_form_template",
    );
    expect(usable(ALL_SCOPES, set("users:profile-requests:review"))).toContain(
      "list_profile_change_requests",
    );
  });

  it("superadmin con todos los scopes: todas las tools (y no hay otras)", () => {
    expect(usable(ALL_SCOPES, SUPERADMIN)).toEqual([...ALL_TOOLS].sort());
  });

  it("el scope es un tope: sin management:read, ni el superadmin consulta gestión", () => {
    expect(
      usable(
        ["reservations:read", "reservations:write", "news:write"],
        SUPERADMIN,
      ),
    ).toEqual(
      [
        ...PUBLIC,
        ...RESERVATIONS,
        "create_news_draft",
        "update_news_draft",
      ].sort(),
    );
  });
});

describe("scopeAppliesTo", () => {
  it("a una cuenta sin gestión no se le ofrecen scopes de gestión", () => {
    expect(scopeAppliesTo("reservations:read", set())).toBe(true);
    expect(scopeAppliesTo("management:read", set())).toBe(false);
    expect(scopeAppliesTo("news:write", set())).toBe(false);
  });

  it("los ofrece según el rol", () => {
    expect(scopeAppliesTo("management:read", set("reports:view"))).toBe(true);
    expect(scopeAppliesTo("news:write", set("reports:view"))).toBe(false);
    expect(scopeAppliesTo("news:write", set("news:manage"))).toBe(true);
    // Permisos que no tienen ninguna tool (p. ej. roles) no habilitan nada.
    expect(
      scopeAppliesTo("management:read", set("roles:manage", "audit:view")),
    ).toBe(false);
  });
});
