import { exportCell, exportColumns } from "@/lib/events/form-export";
import type {
  FormSchema,
  GroupNode,
  InputNode,
} from "@/lib/events/form-schema";
import { describe, expect, it } from "vitest";

const schema: FormSchema = {
  version: 1,
  nodes: [
    {
      kind: "input",
      id: "name",
      type: "SHORT_TEXT",
      label: "Nombre",
      required: true,
    },
    {
      kind: "group",
      id: "team",
      label: "Integrantes",
      repeat: { countFrom: "count" },
      children: [
        {
          kind: "input",
          id: "mn",
          type: "SHORT_TEXT",
          label: "Nombre",
          required: true,
        },
        { kind: "input", id: "md", type: "DNI", label: "DNI", required: true },
      ],
    } as GroupNode,
    {
      kind: "group",
      id: "contact",
      label: "Contacto",
      children: [
        {
          kind: "input",
          id: "ph",
          type: "PHONE",
          label: "Tel",
          required: false,
        },
      ],
    } as GroupNode,
  ] as (InputNode | GroupNode)[],
};

describe("exportColumns", () => {
  it("produces one leaf column per input, prefixing group children", () => {
    expect(exportColumns(schema)).toEqual([
      { key: "name", label: "Nombre", path: ["name"] },
      { key: "team.mn", label: "Integrantes — Nombre", path: ["team", "mn"] },
      { key: "team.md", label: "Integrantes — DNI", path: ["team", "md"] },
      { key: "contact.ph", label: "Contacto — Tel", path: ["contact", "ph"] },
    ]);
  });
});

describe("exportCell", () => {
  const cols = exportColumns(schema);
  const answers = {
    name: "Ana",
    team: [
      { mn: "Juan", md: "111" },
      { mn: "Eva", md: "222" },
    ],
    contact: { ph: "345" },
  };

  it("renders a top-level answer", () => {
    expect(exportCell(cols[0], answers)).toBe("Ana");
  });

  it("joins a repeating group's child across items", () => {
    expect(exportCell(cols[1], answers)).toBe("Juan | Eva");
    expect(exportCell(cols[2], answers)).toBe("111 | 222");
  });

  it("renders a fixed group's child", () => {
    expect(exportCell(cols[3], answers)).toBe("345");
  });

  it("returns empty string for missing answers", () => {
    expect(exportCell(cols[0], {})).toBe("");
    expect(exportCell(cols[1], {})).toBe("");
  });
});
