import { describe, expect, it } from "vitest";
import {
  cloneSchemaWithNewIds,
  extractMembers,
  hasMemberNodes,
  pruneAnswers,
  validateForm,
} from "./form-engine";
import { exportCell, exportColumns } from "./form-export";
import {
  type FormSchema,
  formSchemaZod,
  PRIMARY_PARTICIPANT_KEY,
} from "./form-schema";

/** Equipo: quien inscribe + un co-capitán obligatorio + de 0 a 3 integrantes opcionales. */
const schema: FormSchema = {
  version: 1,
  participant: {
    fields: [
      { key: "nombre", type: "SHORT_TEXT", label: "Nombre", required: true },
      { key: "dni", type: "DNI", label: "DNI", required: false },
    ],
  },
  nodes: [
    {
      kind: "input",
      id: "equipo",
      type: "SHORT_TEXT",
      label: "Equipo",
      required: true,
    },
    { kind: "participant", id: "co", label: "Co-capitán", required: true },
    {
      kind: "group",
      id: "integrantes",
      label: "Integrantes",
      repeat: { min: 0, max: 3, itemLabel: "Integrante {{n}}" },
      children: [
        { kind: "participant", id: "p", label: "Persona", required: false },
      ],
    },
  ],
};

const answers = {
  [PRIMARY_PARTICIPANT_KEY]: { nombre: "Ana", dni: "30111222", extra: "x" },
  equipo: "Los Teros",
  co: { email: " bo@x.com ", nombre: "Bo", sobra: 1 },
  integrantes: [
    { p: { email: "cy@x.com", nombre: "Cy" } },
    { p: {} },
    { p: { email: "di@x.com", nombre: "Di", dni: "40111222" } },
  ],
};

describe("participantes en el motor de formularios (milestone 34)", () => {
  it("el schema con forma y nodos participante es válido", () => {
    expect(formSchemaZod.safeParse(schema).success).toBe(true);
  });

  it("valida a quien inscribe, al obligatorio y a los integrantes completados", () => {
    expect(validateForm(schema, answers).ok).toBe(true);
    const r = validateForm(schema, {
      ...answers,
      [PRIMARY_PARTICIPANT_KEY]: {},
      co: { nombre: "Bo" },
      integrantes: [{ p: { email: "mal", nombre: "" } }],
    });
    expect(r.errors).toMatchObject({
      [`${PRIMARY_PARTICIPANT_KEY}.nombre`]: "Este campo es obligatorio",
      "co.email": "El email es obligatorio",
      "integrantes.0.p.email": "Email inválido",
      "integrantes.0.p.nombre": "Este campo es obligatorio",
    });
  });

  it("un integrante opcional en blanco no se valida ni se guarda", () => {
    const pruned = pruneAnswers(schema, answers);
    expect((pruned.integrantes as unknown[])[1]).toEqual({});
    // Solo el email y las claves de la forma: nada inventado por el cliente.
    expect(pruned.co).toEqual({ email: "bo@x.com", nombre: "Bo" });
    expect(pruned[PRIMARY_PARTICIPANT_KEY]).toEqual({
      nombre: "Ana",
      dni: "30111222",
    });
  });

  it("extrae los integrantes con su ruta y etiqueta, en orden", () => {
    const members = extractMembers(schema, pruneAnswers(schema, answers));
    expect(members.map((m) => [m.nodePath, m.label, m.email])).toEqual([
      ["co", "Co-capitán", "bo@x.com"],
      ["integrantes.0.p", "Integrante 1 — Persona", "cy@x.com"],
      ["integrantes.2.p", "Integrante 3 — Persona", "di@x.com"],
    ]);
    expect(members[2].data).toEqual({ nombre: "Di", dni: "40111222" });
    expect(hasMemberNodes(schema)).toBe(true);
    expect(hasMemberNodes({ version: 1, nodes: [] })).toBe(false);
  });

  it("un formulario anterior (sin forma) sigue igual: solo el email", () => {
    const legacy: FormSchema = {
      version: 1,
      nodes: [
        {
          kind: "input",
          id: "a",
          type: "SHORT_TEXT",
          label: "A",
          required: true,
        },
      ],
    };
    expect(validateForm(legacy, { a: "x" }).ok).toBe(true);
    expect(
      pruneAnswers(legacy, { a: "x", [PRIMARY_PARTICIPANT_KEY]: { z: 1 } }),
    ).toEqual({
      a: "x",
    });
  });

  it("clonar conserva la forma y cambia los ids de los nodos", () => {
    const c = cloneSchemaWithNewIds(schema);
    expect(c.participant).toEqual(schema.participant);
    expect(c.nodes[1].kind).toBe("participant");
    expect(c.nodes[1].id).not.toBe("co");
  });

  it("la exportación tiene columnas para quien inscribe y una por integrante", () => {
    const cols = exportColumns(schema);
    expect(cols.map((c) => c.label)).toEqual([
      "Nombre",
      "DNI",
      "Equipo",
      "Co-capitán",
      "Integrantes — Persona",
    ]);
    const pruned = pruneAnswers(schema, answers);
    expect(exportCell(cols[3], pruned)).toBe("bo@x.com · Bo");
    expect(exportCell(cols[0], pruned)).toBe("Ana");
  });
});
