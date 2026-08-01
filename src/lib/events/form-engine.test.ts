import { validateAnswers } from "@/lib/events/answers";
import {
  type AnswerMap,
  cloneSchemaWithNewIds,
  evaluateCondition,
  flatFieldsToSchema,
  type FlatFieldInput,
  pruneAnswers,
  repeatCount,
  schemaToPublicFields,
  validateForm,
} from "@/lib/events/form-engine";
import type {
  FormSchema,
  GroupNode,
  InputNode,
} from "@/lib/events/form-schema";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Parity: on a flat form, validateForm must match the legacy validateAnswers
// (the single-source guarantee that keeps existing behavior unchanged).
// ---------------------------------------------------------------------------

const flatFields: FlatFieldInput[] = [
  { id: "name", type: "SHORT_TEXT", label: "Nombre", required: true },
  { id: "bio", type: "LONG_TEXT", label: "Bio", required: false },
  { id: "age", type: "NUMBER", label: "Edad", required: true },
  { id: "dob", type: "DATE", label: "Nacimiento", required: false },
  { id: "at", type: "TIME", label: "Hora", required: false },
  { id: "tel", type: "PHONE", label: "Teléfono", required: false },
  { id: "dni", type: "DNI", label: "DNI", required: true },
  {
    id: "role",
    type: "SINGLE_SELECT",
    label: "Rol",
    required: true,
    options: ["Estudiante", "Docente"],
  },
  {
    id: "days",
    type: "MULTI_SELECT",
    label: "Días",
    required: false,
    options: ["Lun", "Mar"],
  },
];

const flatSchema = flatFieldsToSchema(flatFields);
const publicFields = schemaToPublicFields(flatSchema);

describe("validateForm parity with validateAnswers (flat forms)", () => {
  const cases: AnswerMap[] = [
    {}, // all empty
    { name: "Ana", age: "30", dni: "12345678", role: "Docente" }, // valid required
    { name: "Ana", age: "no", dni: "12", role: "X", days: ["Lun", "Nope"] }, // various invalid
    {
      name: "Ana",
      bio: "hola",
      age: "5",
      dob: "2020-13-40",
      at: "99:99",
      tel: "!!",
      dni: "12345678",
      role: "Estudiante",
      days: ["Mar"],
    },
  ];

  it.each(cases.map((c, i) => [i, c] as const))(
    "case %i produces identical errors",
    (_i, answers) => {
      const legacy = validateAnswers(publicFields, answers);
      const next = validateForm(flatSchema, answers);
      expect(next.errors).toEqual(legacy.errors);
      expect(next.ok).toBe(legacy.ok);
    },
  );
});

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

describe("evaluateCondition", () => {
  const scope: AnswerMap[] = [
    { role: "Docente", age: "40", days: ["Lun", "Mar"], name: "" },
  ];

  it("eq / neq (string + numeric coercion)", () => {
    expect(
      evaluateCondition({ op: "eq", field: "role", value: "Docente" }, scope),
    ).toBe(true);
    expect(
      evaluateCondition({ op: "neq", field: "role", value: "Docente" }, scope),
    ).toBe(false);
    expect(
      evaluateCondition({ op: "eq", field: "age", value: 40 }, scope),
    ).toBe(true);
  });

  it("in / nin", () => {
    expect(
      evaluateCondition(
        { op: "in", field: "role", value: ["Docente", "Tutor"] },
        scope,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { op: "nin", field: "role", value: ["Estudiante"] },
        scope,
      ),
    ).toBe(true);
  });

  it("numeric comparisons", () => {
    expect(
      evaluateCondition({ op: "gt", field: "age", value: 18 }, scope),
    ).toBe(true);
    expect(
      evaluateCondition({ op: "lte", field: "age", value: 40 }, scope),
    ).toBe(true);
    expect(
      evaluateCondition({ op: "lt", field: "age", value: 40 }, scope),
    ).toBe(false);
  });

  it("contains (multiselect array)", () => {
    expect(
      evaluateCondition({ op: "contains", field: "days", value: "Lun" }, scope),
    ).toBe(true);
    expect(
      evaluateCondition({ op: "contains", field: "days", value: "Vie" }, scope),
    ).toBe(false);
  });

  it("answered / empty", () => {
    expect(evaluateCondition({ op: "answered", field: "role" }, scope)).toBe(
      true,
    );
    expect(evaluateCondition({ op: "empty", field: "name" }, scope)).toBe(true);
    expect(evaluateCondition({ op: "answered", field: "missing" }, scope)).toBe(
      false,
    );
  });

  it("and / or / not", () => {
    expect(
      evaluateCondition(
        {
          op: "and",
          conditions: [
            { op: "eq", field: "role", value: "Docente" },
            { op: "gt", field: "age", value: 18 },
          ],
        },
        scope,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        {
          op: "or",
          conditions: [
            { op: "eq", field: "role", value: "X" },
            { op: "empty", field: "name" },
          ],
        },
        scope,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { op: "not", condition: { op: "empty", field: "role" } },
        scope,
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Visibility gating + prune
// ---------------------------------------------------------------------------

describe("branching visibility", () => {
  const schema: FormSchema = {
    version: 1,
    nodes: [
      {
        kind: "input",
        id: "role",
        type: "SINGLE_SELECT",
        label: "Rol",
        required: true,
        options: ["Estudiante", "Docente"],
      },
      {
        kind: "input",
        id: "school",
        type: "SHORT_TEXT",
        label: "Escuela",
        required: true,
        visibleWhen: { op: "eq", field: "role", value: "Docente" },
      } as InputNode,
    ],
  };

  it("hidden required field does not error", () => {
    const res = validateForm(schema, { role: "Estudiante" });
    expect(res.ok).toBe(true);
  });

  it("shown required field errors when empty", () => {
    const res = validateForm(schema, { role: "Docente" });
    expect(res.errors).toEqual({ school: "Este campo es obligatorio" });
  });

  it("prune drops answers for hidden branches", () => {
    const pruned = pruneAnswers(schema, {
      role: "Estudiante",
      school: "stale",
    });
    expect(pruned).toEqual({ role: "Estudiante" });
  });
});

// ---------------------------------------------------------------------------
// Repeating groups
// ---------------------------------------------------------------------------

describe("repeating groups", () => {
  const membersGroup: GroupNode = {
    kind: "group",
    id: "members",
    label: "Integrantes",
    repeat: {
      countFrom: "count",
      min: 1,
      max: 5,
      itemLabel: "Integrante {{n}}",
    },
    children: [
      {
        kind: "input",
        id: "mname",
        type: "SHORT_TEXT",
        label: "Nombre",
        required: true,
      },
      { kind: "input", id: "mdni", type: "DNI", label: "DNI", required: true },
    ],
  };
  const schema: FormSchema = {
    version: 1,
    nodes: [
      {
        kind: "input",
        id: "count",
        type: "INTEGER",
        label: "¿Cuántos?",
        required: true,
        constraints: { min: 1, max: 5 },
      },
      membersGroup,
    ],
  };

  it("repeatCount is driven by the countFrom answer and clamped to min/max", () => {
    expect(repeatCount(membersGroup, [{ count: "3" }])).toBe(3);
    expect(repeatCount(membersGroup, [{ count: "0" }])).toBe(1); // clamp to min
    expect(repeatCount(membersGroup, [{ count: "99" }])).toBe(5); // clamp to max
  });

  it("validates each item and path-keys the errors", () => {
    const res = validateForm(schema, {
      count: "2",
      members: [
        { mname: "Ana", mdni: "12345678" },
        { mname: "", mdni: "bad" },
      ],
    });
    expect(res.errors).toEqual({
      "members.1.mname": "Este campo es obligatorio",
      "members.1.mdni": "DNI inválido",
    });
  });

  it("enforces min items", () => {
    const res = validateForm(schema, { count: "2", members: [] });
    expect(res.errors["members"]).toBe("Agregá al menos 1");
  });

  it("prune preserves the array structure and drops unknown keys within items", () => {
    const pruned = pruneAnswers(schema, {
      count: "1",
      members: [{ mname: "Ana", mdni: "12345678", junk: "x" }],
    });
    expect(pruned).toEqual({
      count: "1",
      members: [{ mname: "Ana", mdni: "12345678" }],
    });
  });
});

// ---------------------------------------------------------------------------
// New scalar types
// ---------------------------------------------------------------------------

describe("new scalar field types", () => {
  const schema: FormSchema = {
    version: 1,
    nodes: [
      {
        kind: "input",
        id: "qty",
        type: "INTEGER",
        label: "Cantidad",
        required: true,
        constraints: { min: 1, max: 10 },
      },
      {
        kind: "input",
        id: "price",
        type: "MONEY",
        label: "Precio",
        required: false,
      },
      {
        kind: "input",
        id: "ratio",
        type: "FLOAT",
        label: "Ratio",
        required: false,
      },
    ],
  };

  it("rejects non-integers and out-of-range for INTEGER", () => {
    expect(validateForm(schema, { qty: "2.5" }).errors.qty).toBe(
      "Debe ser un número entero",
    );
    expect(validateForm(schema, { qty: "0" }).errors.qty).toBe("Mínimo 1");
    expect(validateForm(schema, { qty: "11" }).errors.qty).toBe("Máximo 10");
    expect(validateForm(schema, { qty: "5" }).ok).toBe(true);
  });

  it("rejects negative MONEY, accepts decimals", () => {
    expect(validateForm(schema, { qty: "1", price: "-3" }).errors.price).toBe(
      "El monto no puede ser negativo",
    );
    expect(validateForm(schema, { qty: "1", price: "9.99" }).ok).toBe(true);
  });

  it("accepts decimal FLOAT", () => {
    expect(validateForm(schema, { qty: "1", ratio: "3.14" }).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Compat round-trip
// ---------------------------------------------------------------------------

describe("cloneSchemaWithNewIds", () => {
  const schema: FormSchema = {
    version: 1,
    nodes: [
      { kind: "input", id: "a", type: "INTEGER", label: "N", required: true },
      {
        kind: "input",
        id: "b",
        type: "SHORT_TEXT",
        label: "Detalle",
        required: true,
        visibleWhen: { op: "gt", field: "a", value: 0 },
      } as InputNode,
      {
        kind: "group",
        id: "g",
        label: "Items",
        repeat: { countFrom: "a" },
        children: [
          {
            kind: "input",
            id: "c",
            type: "SHORT_TEXT",
            label: "X",
            required: true,
          },
        ],
      } as GroupNode,
    ],
  };

  it("assigns fresh ids and remaps condition + countFrom references", () => {
    const clone = cloneSchemaWithNewIds(schema);
    const [a2, b2, g2] = clone.nodes as [InputNode, InputNode, GroupNode];

    // All ids are new.
    expect(a2.id).not.toBe("a");
    expect(b2.id).not.toBe("b");
    expect(g2.id).not.toBe("g");
    expect(g2.children[0].id).not.toBe("c");

    // References now point at the new ids.
    const cond = b2.visibleWhen as { op: string; field: string; value: number };
    expect(cond.field).toBe(a2.id);
    expect(g2.repeat?.countFrom).toBe(a2.id);

    // Structure/values otherwise preserved.
    expect(cond.value).toBe(0);
    expect(b2.label).toBe("Detalle");
  });
});

describe("flatFieldsToSchema <-> schemaToPublicFields", () => {
  it("round-trips a flat field list", () => {
    const back = schemaToPublicFields(flatFieldsToSchema(flatFields));
    expect(back).toEqual(
      flatFields.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder ?? null,
        required: f.required,
        options: f.options ?? null,
        constraints: f.constraints ?? null,
        visibleWhen: f.visibleWhen ?? null,
      })),
    );
  });
});
