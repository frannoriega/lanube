import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "./actions";
import {
  AUDIT_ENTITIES,
  AUDIT_EVENTS,
  auditFieldSpecs,
  type AuditEventDef,
} from "./registry";

/**
 * Milestone 16: el registro es la única fuente de verdad de la auditoría. Estos tests
 * fallan si falta alguna de las piezas que necesita un evento nuevo para verse bien.
 */
describe("registro de auditoría", () => {
  const events = Object.entries(AUDIT_EVENTS as Record<string, AuditEventDef>);

  it("cada evento apunta a una entidad registrada", () => {
    for (const [id, def] of events) {
      expect(def.entity in AUDIT_ENTITIES, `${id} → ${def.entity}`).toBe(true);
    }
  });

  it("cada evento tiene su frase y su chip", () => {
    for (const [id, def] of events) {
      expect(def.label.trim(), `${id} sin label`).not.toBe("");
      expect(def.verb.trim(), `${id} sin verb`).not.toBe("");
    }
  });

  it("AUDIT_ACTIONS nombra todos los eventos, y nada más", () => {
    expect(new Set(Object.values(AUDIT_ACTIONS))).toEqual(
      new Set(Object.keys(AUDIT_EVENTS)),
    );
  });

  it("cada campo registrado tiene rótulo", () => {
    for (const [entity, def] of Object.entries(AUDIT_ENTITIES)) {
      for (const [key, spec] of Object.entries(def.fields)) {
        expect(spec.label.trim(), `${entity}.${key}`).not.toBe("");
      }
    }
  });

  it("el subject de una entidad es uno de sus campos", () => {
    for (const [entity, def] of Object.entries(AUDIT_ENTITIES)) {
      const subject = (def as { subject?: { key: string } }).subject;
      if (!subject) continue;
      expect(subject.key in def.fields, `${entity}.${subject.key}`).toBe(true);
    }
  });

  it("toda entidad con altas/bajas/ediciones tiene su foto en snapshots.ts", () => {
    // Se lee el archivo en vez de importarlo: es server-only (Prisma).
    const source = readFileSync(
      join(process.cwd(), "src/lib/audit/snapshots.ts"),
      "utf8",
    );
    const needing = new Set(
      events.filter(([, d]) => d.kind !== "custom").map(([, d]) => d.entity),
    );
    for (const entity of needing) {
      expect(
        new RegExp(`^\\s{2}${entity}:`, "m").test(source),
        `${entity} necesita un loader en SNAPSHOTS`,
      ).toBe(true);
    }
  });

  it("combina los campos de la entidad con los propios del evento", () => {
    const specs = auditFieldSpecs("participant.decide", "Event");
    expect(specs.decision?.label).toBe("Decisión");
    expect(specs.name?.label).toBe("Nombre");
  });

  it("una acción desconocida usa los campos de la entidad de la entrada", () => {
    expect(auditFieldSpecs("event.ancient", "Event").name?.label).toBe(
      "Nombre",
    );
  });
});
