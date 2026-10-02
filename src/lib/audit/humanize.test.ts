import { describe, expect, it } from "vitest";
import {
  buildChangeSummary,
  buildFieldChanges,
  entityDisplayLabel,
  entitySubject,
  entityTypeLabel,
} from "./humanize";

describe("buildFieldChanges", () => {
  it("skips unchanged fields and renders values as plain text", () => {
    const changes = buildFieldChanges(
      { capacity: 10, isExclusive: false, name: "Sala A" },
      { capacity: 20, isExclusive: false, name: "Sala A" },
    );
    expect(changes).toEqual([
      { key: "capacity", label: "Capacidad", before: "10", after: "20" },
    ]);
  });

  it("treats a missing side as creation/deletion, not JSON", () => {
    const changes = buildFieldChanges(undefined, {
      name: "Taller",
      status: "DRAFT",
    });
    expect(changes).toContainEqual({
      key: "name",
      label: "Nombre",
      before: "(vacío)",
      after: "Taller",
    });
    expect(changes).toContainEqual({
      key: "status",
      label: "Estado",
      before: "(vacío)",
      after: "Borrador",
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
    expect(summary).toBe("Edición del espacio: #s1 — capacidad: 10 → 20.");
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
