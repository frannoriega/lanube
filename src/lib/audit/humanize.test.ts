import { describe, expect, it } from "vitest";
import {
  buildChangeSummary,
  buildFieldChanges,
  entityDisplayLabel,
  entitySubject,
  entityTypeLabel,
  entryFieldChanges,
} from "./humanize";

describe("buildFieldChanges", () => {
  it("skips unchanged fields and renders values as plain text", () => {
    const changes = buildFieldChanges(
      { capacity: 10, isExclusive: false, name: "Sala A" },
      { capacity: 20, isExclusive: false, name: "Sala A" },
    );
    expect(changes).toEqual([
      {
        kind: "value",
        key: "capacity",
        label: "Capacidad",
        before: "10",
        after: "20",
      },
    ]);
  });

  it("treats a missing side as creation/deletion, not JSON", () => {
    const changes = buildFieldChanges(undefined, {
      name: "Taller",
      status: "DRAFT",
    });
    expect(changes).toContainEqual({
      kind: "value",
      key: "name",
      label: "Nombre",
      before: "(vacío)",
      after: "Taller",
    });
    expect(changes).toContainEqual({
      kind: "value",
      key: "status",
      label: "Estado",
      before: "(vacío)",
      after: "Borrador",
    });
  });
});

describe("buildFieldChanges — ids, conjuntos y reordenamientos", () => {
  it("oculta los ids del sistema y deja su equivalente con nombre", () => {
    const changes = buildFieldChanges(
      { roleId: "clxa", role: "Usuario" },
      { roleId: "clxb", role: "Administrador" },
    );
    expect(changes.map((c) => c.key)).toEqual(["role"]);
  });

  it("compara listas como conjunto y traduce los permisos", () => {
    const changes = buildFieldChanges(
      { permissions: ["admin:access", "events:manage"] },
      { permissions: ["events:manage", "admin:access", "forms:manage"] },
    );
    expect(changes).toEqual([
      {
        kind: "set",
        key: "permissions",
        label: "Permisos",
        added: ["Gestionar formularios"],
        removed: [],
      },
    ]);
  });

  it("no informa un conjunto que solo cambió de orden", () => {
    expect(
      buildFieldChanges(
        { permissions: ["a", "b"] },
        { permissions: ["b", "a"] },
      ),
    ).toEqual([]);
  });

  it("arma el diff de posiciones de un reordenamiento con nombres", () => {
    const [change] = buildFieldChanges(
      {
        order: [
          { id: "1", name: "Coworking" },
          { id: "2", name: "Laboratorio" },
          { id: "3", name: "Auditorio" },
        ],
      },
      {
        order: [
          { id: "3", name: "Auditorio" },
          { id: "1", name: "Coworking" },
          { id: "2", name: "Laboratorio" },
        ],
      },
    );
    expect(change).toEqual({
      kind: "order",
      key: "order",
      label: "Orden",
      hasBefore: true,
      rows: [
        { id: "3", name: "Auditorio", from: 3, to: 1 },
        { id: "1", name: "Coworking", from: 1, to: 2 },
        { id: "2", name: "Laboratorio", from: 2, to: 3 },
      ],
    });
  });

  it("marca lo que salió de la lista", () => {
    const [change] = buildFieldChanges(
      {
        order: [
          { id: "1", name: "A" },
          { id: "2", name: "B" },
        ],
      },
      { order: [{ id: "2", name: "B" }] },
    );
    expect(change.kind === "order" && change.rows).toEqual([
      { id: "2", name: "B", from: 2, to: 1 },
      { id: "1", name: "A", from: 1, to: null },
    ]);
  });

  it("resuelve el formato viejo (solo orderedIds) con los nombres del servidor", () => {
    const [change] = buildFieldChanges(
      null,
      { orderedIds: ["1", "gone"] },
      { "1": "Coworking" },
    );
    expect(change).toEqual({
      kind: "order",
      key: "orderedIds",
      label: "Orden",
      hasBefore: false,
      rows: [
        { id: "1", name: "Coworking", from: null, to: 1 },
        { id: "gone", name: "(eliminado)", from: null, to: 2 },
      ],
    });
  });
});

describe("entityDisplayLabel", () => {
  it("prefers a name/title/key from either side", () => {
    expect(entityDisplayLabel(null, { title: "Mi noticia" }, "abc123")).toBe(
      '"Mi noticia"',
    );
  });

  it("falls back to a short id when no label field is present", () => {
    expect(
      entityDisplayLabel(null, { orderedIds: ["a", "b"] }, "clx0123456789"),
    ).toBe("#clx01234");
  });
});

describe("buildChangeSummary", () => {
  it("reads as a sentence with before -> after, not JSON", () => {
    const summary = buildChangeSummary({
      action: "space.update",
      entityType: "Space",
      entityId: "s1",
      before: { capacity: 10 },
      after: { capacity: 20 },
    });
    expect(summary).toBe(
      "Edición del espacio: #s1 — capacidad: 10 personas → 20 personas.",
    );
  });

  it("falls back to a plain sentence when nothing changed", () => {
    const summary = buildChangeSummary({
      action: "news.decide",
      entityType: "NewsPost",
      entityId: "n1",
      before: { status: "PENDING_REVIEW" },
      after: { status: "PENDING_REVIEW" },
    });
    expect(summary).toBe("Decisión de la noticia: #n1.");
  });

  it("prefers the recorded context over sniffing a name, even when only status changed", () => {
    const summary = buildChangeSummary({
      action: "reservation.approve",
      entityType: "Reservation",
      entityId: "r1",
      before: { status: "PENDING" },
      after: { status: "APPROVED" },
      context: {
        Espacio: "Sala A",
        Horario: "jueves 9 de julio, 10:00–12:00",
        "Reservado por": "Juan Pérez",
      },
    });
    expect(summary).toBe(
      "Aprobación de la reserva: Sala A, jueves 9 de julio, 10:00–12:00, Juan Pérez — estado: Pendiente → Aprobado.",
    );
  });
});

describe("buildChangeSummary — reordenamientos", () => {
  it("usa la etiqueta de la acción (sin '#*') y nombra lo que se movió", () => {
    const summary = buildChangeSummary({
      action: "space.reorder",
      entityType: "Space",
      entityId: "*",
      before: {
        order: [
          { id: "1", name: "Coworking" },
          { id: "2", name: "Laboratorio" },
        ],
      },
      after: {
        order: [
          { id: "2", name: "Laboratorio" },
          { id: "1", name: "Coworking" },
        ],
      },
    });
    expect(summary).toBe(
      "Reordenó los espacios — Laboratorio: 2º → 1º, Coworking: 1º → 2º.",
    );
  });

  it("en una entrada vieja muestra el orden final con nombres", () => {
    const summary = buildChangeSummary({
      action: "space.reorder",
      entityType: "Space",
      entityId: "*",
      before: null,
      after: { orderedIds: ["1", "2", "3", "4"] },
      names: { "1": "A", "2": "B", "3": "C", "4": "D" },
    });
    expect(summary).toBe("Reordenó los espacios — nuevo orden: A, B y 2 más.");
  });
});

describe("entitySubject", () => {
  it("joins context values when present", () => {
    expect(
      entitySubject({
        action: "reservation.approve",
        entityType: "Reservation",
        entityId: "r1",
        before: null,
        after: null,
        context: { Espacio: "Sala A", Horario: "10:00" },
      }),
    ).toBe("Sala A, 10:00");
  });

  it("falls back to entityDisplayLabel when there's no context", () => {
    expect(
      entitySubject({
        action: "news.update",
        entityType: "NewsPost",
        entityId: "n1",
        before: null,
        after: { title: "Mi noticia" },
      }),
    ).toBe('"Mi noticia"');
  });
});

describe("entityTypeLabel", () => {
  it("falls back to the raw id for an unmapped entity type", () => {
    expect(entityTypeLabel("SomethingNew")).toBe("SomethingNew");
  });
});

describe("entryFieldChanges — campos del registro (milestone 16)", () => {
  it("usa el tipo del campo: enum traducido, texto largo con diff, imagen", () => {
    const changes = entryFieldChanges({
      action: "event.update",
      entityType: "Event",
      entityId: "e1",
      before: {
        status: "DRAFT",
        description: "Una línea\nOtra línea",
        imageUrl: "/a.png",
      },
      after: {
        status: "PUBLISHED",
        description: "Una línea\nOtra línea cambiada",
        imageUrl: "/b.png",
      },
    });
    expect(changes.map((c) => c.kind)).toEqual(["value", "text", "image"]);
    expect(changes[0]).toMatchObject({
      before: "Borrador",
      after: "Publicado",
    });
    expect(changes[2]).toMatchObject({ before: "/a.png", after: "/b.png" });
  });

  it("ordena los cambios como los declara la entidad", () => {
    const keys = entryFieldChanges({
      action: "space.update",
      entityType: "Space",
      entityId: "s1",
      before: { capacity: 1, name: "A" },
      after: { capacity: 2, name: "B" },
    }).map((c) => c.key);
    expect(keys).toEqual(["name", "capacity"]);
  });

  it("una pregunta de formulario cambiada se lista con sus campos", () => {
    const [change] = entryFieldChanges({
      action: "form.update",
      entityType: "Form",
      entityId: "f1",
      before: {
        fields: [
          { id: "q1", label: "Nombre", type: "SHORT_TEXT", required: false },
          { id: "q2", label: "Edad", type: "INTEGER", required: false },
        ],
      },
      after: {
        fields: [
          { id: "q1", label: "Nombre", type: "SHORT_TEXT", required: true },
          { id: "q3", label: "DNI", type: "SHORT_TEXT", required: true },
        ],
      },
    });
    expect(change.kind).toBe("items");
    if (change.kind !== "items") return;
    expect(change.rows.map((r) => [r.name, r.status])).toEqual([
      ["Nombre", "changed"],
      ["DNI", "added"],
      ["Edad", "removed"],
    ]);
    expect(change.rows[0].changes[0]).toMatchObject({
      label: "Obligatoria",
      before: "No",
      after: "Sí",
    });
  });

  it("un alta resume solo los valores nuevos, sin '(vacío) →'", () => {
    expect(
      buildChangeSummary({
        action: "resource.create",
        entityType: "Resource",
        entityId: "r1",
        before: null,
        after: { name: "Proyector", serialNumber: "X1" },
        context: { Recurso: "Proyector" },
      }),
    ).toBe(
      "Creación del recurso: Proyector — nombre: Proyector, número de serie: X1.",
    );
  });

  it("una baja no lista campos", () => {
    expect(
      buildChangeSummary({
        action: "resource.delete",
        entityType: "Resource",
        entityId: "r1",
        before: { name: "Proyector" },
        after: null,
        context: { Recurso: "Proyector" },
      }),
    ).toBe("Eliminación del recurso: Proyector.");
  });
});
