import {
  extensionAllowed,
  fileExtension,
  validateScalar,
} from "@/lib/events/form-engine";
import {
  collectUploadedFiles,
  findFileNode,
  validateUploadMeta,
} from "@/lib/events/form-files";
import type {
  FormSchema,
  GroupNode,
  InputNode,
} from "@/lib/events/form-schema";
import { describe, expect, it } from "vitest";

const boolNode = (required: boolean): InputNode => ({
  kind: "input",
  id: "ack",
  type: "BOOLEAN",
  label: "Acepto",
  required,
});

const fileNode = (constraints: InputNode["constraints"] = null): InputNode => ({
  kind: "input",
  id: "cv",
  type: "FILE",
  label: "Archivo",
  required: false,
  constraints,
});

const oneMb = 1024 * 1024;
const descriptor = (name: string, size: number) => ({
  url: `local-private:x/${name}`,
  name,
  size,
  type: "application/pdf",
});

describe("BOOLEAN validation", () => {
  it("required must be explicitly true", () => {
    expect(validateScalar(boolNode(true), true)).toBeNull();
    expect(validateScalar(boolNode(true), false)).toMatch(/marcar/);
    expect(validateScalar(boolNode(true), undefined)).toMatch(/marcar/);
  });

  it("optional accepts false / unset", () => {
    expect(validateScalar(boolNode(false), false)).toBeNull();
    expect(validateScalar(boolNode(false), undefined)).toBeNull();
    expect(validateScalar(boolNode(false), true)).toBeNull();
  });

  it("rejects non-boolean values", () => {
    expect(validateScalar(boolNode(false), "yes")).toMatch(/inválido/);
  });
});

describe("FILE validation", () => {
  it("enforces per-file size cap", () => {
    const node = fileNode({ maxSizeMb: 2 });
    expect(validateScalar(node, [descriptor("a.pdf", oneMb)])).toBeNull();
    expect(validateScalar(node, [descriptor("a.pdf", 3 * oneMb)])).toMatch(
      /menos de 2 MB/,
    );
  });

  it("enforces the extension allow-list", () => {
    const node = fileNode({ accept: ["pdf"] });
    expect(validateScalar(node, [descriptor("a.pdf", oneMb)])).toBeNull();
    expect(validateScalar(node, [descriptor("a.png", oneMb)])).toMatch(
      /Formato no permitido/,
    );
  });

  it("enforces maxFiles (default 1)", () => {
    expect(
      validateScalar(fileNode(), [
        descriptor("a.pdf", oneMb),
        descriptor("b.pdf", oneMb),
      ]),
    ).toMatch(/Máximo 1/);
    expect(
      validateScalar(fileNode({ maxFiles: 2 }), [
        descriptor("a.pdf", oneMb),
        descriptor("b.pdf", oneMb),
      ]),
    ).toBeNull();
  });

  it("required empty file field errors", () => {
    const node = { ...fileNode(), required: true };
    expect(validateScalar(node, [])).toMatch(/obligatorio/);
  });
});

describe("extension helpers", () => {
  it("fileExtension lowercases and strips the name", () => {
    expect(fileExtension("Report.PDF")).toBe("pdf");
    expect(fileExtension("noext")).toBe("");
  });

  it("extensionAllowed tolerates dots/casing and empty list", () => {
    expect(extensionAllowed("a.pdf", [".PDF"])).toBe(true);
    expect(extensionAllowed("a.jpg", ["pdf"])).toBe(false);
    expect(extensionAllowed("a.jpg", null)).toBe(true);
    expect(extensionAllowed("a.jpg", [])).toBe(true);
  });
});

describe("upload helpers", () => {
  const groupChild: InputNode = {
    kind: "input",
    id: "photo",
    type: "FILE",
    label: "Foto",
    required: false,
    constraints: { accept: ["png"] },
  };
  const group: GroupNode = {
    kind: "group",
    id: "team",
    label: "Equipo",
    children: [groupChild],
    repeat: { min: null, max: 3 },
  };
  const schema: FormSchema = {
    version: 1,
    nodes: [fileNode({ accept: ["pdf"], maxSizeMb: 5 }), group],
  };

  it("findFileNode descends into groups", () => {
    expect(findFileNode(schema, "cv")?.id).toBe("cv");
    expect(findFileNode(schema, "photo")?.id).toBe("photo");
    expect(findFileNode(schema, "missing")).toBeNull();
  });

  it("validateUploadMeta mirrors field constraints + 10MB hard cap", () => {
    const node = fileNode({ accept: ["pdf"], maxSizeMb: 5 });
    expect(validateUploadMeta(node, { name: "a.pdf", size: oneMb })).toBeNull();
    expect(validateUploadMeta(node, { name: "a.png", size: oneMb })).toMatch(
      /Formato/,
    );
    expect(
      validateUploadMeta(node, { name: "a.pdf", size: 6 * oneMb }),
    ).toMatch(/menos de 5 MB/);
    expect(
      validateUploadMeta(fileNode(), { name: "a.pdf", size: 11 * oneMb }),
    ).toMatch(/10 MB/);
  });

  it("collectUploadedFiles finds files nested in arrays + objects", () => {
    const answers = {
      cv: [descriptor("a.pdf", oneMb)],
      team: [{ photo: [descriptor("b.png", oneMb)] }],
      name: "n/a",
    };
    const found = collectUploadedFiles(answers).map((f) => f.name);
    expect(found).toEqual(["a.pdf", "b.png"]);
  });
});
