import { describe, expect, it } from "vitest";
import { ECOSYSTEM_STATS } from "@/lib/constants/ecosystem-stats";
import { ABOUT_HELICES, ABOUT_VALUES, aboutAsMarkdown } from "./content";

describe("aboutAsMarkdown", () => {
  const md = aboutAsMarkdown();

  it("incluye todas las secciones de la página", () => {
    for (const heading of [
      "## Qué es La Nube",
      "## El desafío",
      "## La leyenda del logo",
      "## Un ecosistema de cuatro hélices",
      "## Plan 2026–2030",
      "## Misión",
      "## Visión",
      "## Valores",
    ])
      expect(md).toContain(heading);
    for (const h of ABOUT_HELICES) expect(md).toContain(h.title);
    for (const v of ABOUT_VALUES) expect(md).toContain(v);
  });

  it("aclara que las cifras son de la ciudad, no de La Nube", () => {
    expect(md).toContain("cifras de Concepción del Uruguay, no de La Nube");
    for (const s of ECOSYSTEM_STATS) expect(md).toContain(s.label);
  });
});
