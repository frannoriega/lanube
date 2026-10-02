import { describe, expect, it } from "vitest";
import { readingMinutes } from "./reading-time";

const words = (n: number) =>
  Array.from({ length: n }, () => "palabra").join(" ");

describe("readingMinutes", () => {
  it("nunca devuelve menos de 1 minuto", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("Hola")).toBe(1);
  });

  it("redondea a 200 palabras por minuto", () => {
    expect(readingMinutes(words(200))).toBe(1);
    expect(readingMinutes(words(500))).toBe(3); // 2.5 → 3
    expect(readingMinutes(words(1000))).toBe(5);
  });

  it("ignora los marcadores sueltos de markdown", () => {
    const md = ["#", words(150), "-", "-", ">", words(150)].join("\n");
    expect(readingMinutes(md)).toBe(2); // 300 palabras, los símbolos no suman
  });

  it("no cuenta bloques de código ni imágenes", () => {
    const md = `${words(200)}\n\n\`\`\`\n${words(400)}\n\`\`\`\n\n![${words(50)}](https://x/y.png)`;
    expect(readingMinutes(md)).toBe(1);
  });

  it("de un link cuenta solo el texto visible", () => {
    const md = `${words(199)} [ver](https://muy-largo.example/con/muchas/partes)`;
    expect(readingMinutes(md)).toBe(1);
  });
});
