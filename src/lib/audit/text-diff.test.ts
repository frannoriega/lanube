import { describe, expect, it } from "vitest";
import { diffText } from "./text-diff";

describe("diffText", () => {
  it("resalta solo las palabras que cambiaron en una línea reemplazada", () => {
    const lines = diffText("Taller de robótica", "Taller de electrónica");
    expect(lines).toEqual([
      {
        op: "del",
        text: "Taller de robótica",
        parts: [
          { op: "same", text: "Taller de " },
          { op: "del", text: "robótica" },
        ],
      },
      {
        op: "add",
        text: "Taller de electrónica",
        parts: [
          { op: "same", text: "Taller de " },
          { op: "add", text: "electrónica" },
        ],
      },
    ]);
  });

  it("colapsa las líneas iguales lejos del cambio", () => {
    const before = ["a", "b", "c", "d", "e", "f"].join("\n");
    const after = ["a", "b", "c", "d", "e", "F"].join("\n");
    const lines = diffText(before, after);
    expect(lines[0]).toEqual({ op: "gap", count: 4 });
    expect(lines[1]).toEqual({ op: "same", text: "e" });
    expect(lines.slice(2).map((l) => l.op)).toEqual(["del", "add"]);
  });

  it("una línea agregada sin pareja no lleva diff por palabras", () => {
    expect(diffText("a", "a\nb")).toEqual([
      { op: "same", text: "a" },
      { op: "add", text: "b", parts: undefined },
    ]);
  });
});

describe("diffText — textos vacíos", () => {
  it("vaciar un texto es solo una línea quitada, sin línea verde vacía", () => {
    expect(diffText("Prueba", "")).toEqual([
      { op: "del", text: "Prueba", parts: undefined },
    ]);
  });
});
