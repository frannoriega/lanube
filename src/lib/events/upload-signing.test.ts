import {
  contentTypeForName,
  isInlineSafe,
  mapUploadedFiles,
} from "@/lib/events/form-files";
import type { UploadedFile } from "@/lib/events/form-schema";
import {
  signUploadedFile,
  verifyUploadedFile,
} from "@/lib/events/upload-signing";
import { isCanonicalKey } from "@/lib/storage/types";
import { describe, expect, it } from "vitest";

/**
 * Milestone 25, S1/S2: el descriptor de un archivo de participante es entrada del cliente. Estos
 * tests fijan que (1) el tipo lo decide el servidor, (2) solo se aceptan descriptores firmados
 * por nuestra subida para ese evento y (3) una clave con `..` nunca se considera válida.
 */

const SECRET = "secreto-de-prueba";
const base = {
  url: "local-private:dev/events/participant-uploads/taller/abc-cv.pdf",
  name: "cv.pdf",
  size: 1234,
  type: "application/pdf",
};

describe("firma de descriptores", () => {
  it("acepta el descriptor tal como lo firmó la subida", () => {
    const signed = signUploadedFile(base, "evt1", SECRET);
    expect(verifyUploadedFile(signed, "evt1", SECRET)).toBe(true);
  });

  it("rechaza un descriptor sin firma (forjado o anterior a la firma)", () => {
    expect(verifyUploadedFile(base, "evt1", SECRET)).toBe(false);
  });

  it.each([
    ["url", { url: "local-private:../../.env" }],
    ["name", { name: "cv.html" }],
    ["type", { type: "text/html" }],
    ["size", { size: 1 }],
  ])("rechaza si se cambió %s después de firmar", (_campo, cambio) => {
    const signed = signUploadedFile(base, "evt1", SECRET);
    expect(verifyUploadedFile({ ...signed, ...cambio }, "evt1", SECRET)).toBe(
      false,
    );
  });

  it("rechaza la firma de otro evento", () => {
    const signed = signUploadedFile(base, "evt1", SECRET);
    expect(verifyUploadedFile(signed, "evt2", SECRET)).toBe(false);
  });

  it("rechaza una firma de otro largo sin lanzar", () => {
    expect(verifyUploadedFile({ ...base, sig: "x" }, "evt1", SECRET)).toBe(
      false,
    );
  });
});

describe("tipo de contenido decidido por el servidor", () => {
  it.each([
    ["cv.PDF", "application/pdf"],
    ["foto.jpeg", "image/jpeg"],
    ["dibujo.svg", "application/octet-stream"],
    ["pagina.html", "application/octet-stream"],
    ["sin-extension", "application/octet-stream"],
  ])("%s → %s", (name, type) => {
    expect(contentTypeForName(name)).toBe(type);
  });

  it("solo PDF e imágenes rasterizadas se muestran en el navegador", () => {
    expect(isInlineSafe("application/pdf")).toBe(true);
    expect(isInlineSafe("image/png")).toBe(true);
    expect(isInlineSafe("image/svg+xml")).toBe(false);
    expect(isInlineSafe("text/html")).toBe(false);
    expect(isInlineSafe("application/octet-stream")).toBe(false);
  });
});

describe("mapUploadedFiles", () => {
  const file = (name: string): UploadedFile => ({ ...base, name });

  it("reemplaza los descriptores dentro de grupos y repeticiones", () => {
    const answers = {
      nombre: "Ada",
      cv: [file("a.pdf")],
      grupo: [{ adjunto: [file("b.pdf")] }],
    };
    const out = mapUploadedFiles(answers, (f) => ({ ...f, size: 99 })) as {
      cv: UploadedFile[];
      grupo: { adjunto: UploadedFile[] }[];
      nombre: string;
    };
    expect(out.nombre).toBe("Ada");
    expect(out.cv[0].size).toBe(99);
    expect(out.grupo[0].adjunto[0].size).toBe(99);
  });

  it("devuelve null si algún archivo se rechaza", () => {
    const answers = { cv: [file("a.pdf"), file("b.pdf")] };
    expect(
      mapUploadedFiles(answers, (f) => (f.name === "b.pdf" ? null : f)),
    ).toBeNull();
  });
});

describe("claves canónicas de storage", () => {
  it.each([
    "dev/events/participant-uploads/x/a.pdf",
    "prod/events/participant-uploads/a.pdf",
  ])("acepta %s", (key) => {
    expect(isCanonicalKey(key)).toBe(true);
  });

  it.each([
    "../../.env",
    "dev/events/../../secret",
    "dev//a.pdf",
    "./a.pdf",
    "dev\\a.pdf",
    "",
  ])("rechaza %j", (key) => {
    expect(isCanonicalKey(key)).toBe(false);
  });
});
