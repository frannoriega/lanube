import { describe, expect, it } from "vitest";
import { managementCrumbs } from "./management-crumbs";

describe("managementCrumbs", () => {
  it("returns nothing on a shell's own dashboard", () => {
    expect(managementCrumbs("/admin/dashboard", "admin")).toEqual([]);
    expect(managementCrumbs("/user/dashboard", "user")).toEqual([]);
  });

  it("links the section and leaves the current page unlinked", () => {
    expect(managementCrumbs("/admin/news", "admin")).toEqual([
      { name: "Panel", href: "/admin/dashboard" },
      { name: "Noticias" },
    ]);
  });

  it("labels an entity id with the action, never the raw id", () => {
    const crumbs = managementCrumbs("/admin/news/abc123", "admin");
    expect(crumbs).toEqual([
      { name: "Panel", href: "/admin/dashboard" },
      { name: "Noticias", href: "/admin/news" },
      { name: "Editar" },
    ]);
    expect(JSON.stringify(crumbs)).not.toContain("abc123");
  });

  it("agrees in gender with the section's noun", () => {
    expect(managementCrumbs("/admin/news/new", "admin").at(-1)).toEqual({
      name: "Nueva",
    });
    expect(managementCrumbs("/admin/events/new", "admin").at(-1)).toEqual({
      name: "Nuevo",
    });
  });

  it("keeps the edit page reachable from a sub-page", () => {
    expect(managementCrumbs("/admin/events/e1/participants", "admin")).toEqual([
      { name: "Panel", href: "/admin/dashboard" },
      { name: "Eventos", href: "/admin/events" },
      { name: "Editar", href: "/admin/events/e1" },
      { name: "Participantes" },
    ]);
  });

  it("collapses the id + /edit pair into one crumb", () => {
    expect(managementCrumbs("/admin/spaces/s1/edit", "admin")).toEqual([
      { name: "Panel", href: "/admin/dashboard" },
      { name: "Espacios", href: "/admin/spaces" },
      { name: "Editar" },
    ]);
  });

  it("names a space from the sidebar nav instead of its slug", () => {
    expect(
      managementCrumbs("/user/spaces/laboratorio", "user", [
        {
          name: "Laboratorio",
          href: "/user/spaces/laboratorio",
          iconName: null,
        },
      ]),
    ).toEqual([
      { name: "Panel de control", href: "/user/dashboard" },
      // /user/spaces has no index page, so this crumb is deliberately not a link.
      { name: "Espacios" },
      { name: "Laboratorio" },
    ]);
  });
});
