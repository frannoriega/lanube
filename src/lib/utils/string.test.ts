import { describe, expect, it } from "vitest";
import { slugify } from "./string";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Charla de Robótica")).toBe("charla-de-robotica");
  });

  it("strips accents", () => {
    expect(slugify("Inauguración del año académico")).toBe(
      "inauguracion-del-ano-academico",
    );
  });

  it("collapses non-alphanumeric runs into a single hyphen", () => {
    expect(slugify("¡Hola!!  Mundo??")).toBe("hola-mundo");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  -Nota- ")).toBe("nota");
  });

  it("caps length at 80 characters", () => {
    const long = "a".repeat(200);
    expect(slugify(long)).toHaveLength(80);
  });
});
