import { describe, expect, it } from "vitest";
import { bool, longText, setOf, text } from "./fields";
import { normalizeAuditValue, pickAuditSides } from "./pick";

const specs = {
  name: text("Nombre"),
  description: longText("Descripción"),
  isFeatured: bool("Destacado"),
  weekdays: setOf("Días"),
};

describe("pickAuditSides", () => {
  it("en una edición guarda solo lo que cambió, y solo campos registrados", () => {
    expect(
      pickAuditSides(
        "update",
        specs,
        {
          name: "A",
          isFeatured: false,
          updatedAt: BigInt(1),
          weekdays: ["Lun"],
        },
        {
          name: "B",
          isFeatured: false,
          updatedAt: BigInt(2),
          weekdays: ["Lun"],
        },
      ),
    ).toEqual({ before: { name: "A" }, after: { name: "B" } });
  });

  it("no informa una edición sin cambios auditados", () => {
    expect(
      pickAuditSides("update", specs, { name: "A" }, { name: "A" }),
    ).toBeNull();
  });

  it("trata null, '' y [] como el mismo vacío", () => {
    expect(
      pickAuditSides(
        "update",
        specs,
        { description: null, weekdays: [] },
        { description: "", weekdays: null },
      ),
    ).toBeNull();
  });

  it("compara los conjuntos sin importar el orden", () => {
    expect(
      pickAuditSides(
        "update",
        specs,
        { weekdays: ["Lun", "Mié"] },
        { weekdays: ["Mié", "Lun"] },
      ),
    ).toBeNull();
  });

  it("en un alta guarda solo el después, sin vacíos", () => {
    expect(
      pickAuditSides("create", specs, null, {
        name: "Taller",
        description: null,
        isFeatured: false,
      }),
    ).toEqual({ before: null, after: { name: "Taller", isFeatured: false } });
  });

  it("en una baja guarda solo el antes", () => {
    expect(pickAuditSides("delete", specs, { name: "Taller" }, null)).toEqual({
      before: { name: "Taller" },
      after: null,
    });
  });
});

describe("normalizeAuditValue", () => {
  it("convierte bigint y Date a ms, recursivamente", () => {
    expect(
      normalizeAuditValue({
        a: BigInt(5),
        b: [new Date(10)],
        c: { d: BigInt(7) },
      }),
    ).toEqual({ a: 5, b: [10], c: { d: 7 } });
  });
});
