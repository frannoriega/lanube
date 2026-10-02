import { describe, expect, it } from "vitest";
import { COVER_VARIANTS, COVER_VIEWBOX, coverPattern } from "./cover-pattern";

describe("coverPattern", () => {
  it("es determinístico por slug", () => {
    expect(coverPattern("convocatoria-2026")).toEqual(
      coverPattern("convocatoria-2026"),
    );
  });

  it("dos slugs distintos dan redes distintas", () => {
    expect(coverPattern("una-nota").nodes).not.toEqual(
      coverPattern("otra-nota").nodes,
    );
  });

  it("reparte los degradés entre todas las variantes", () => {
    const variants = new Set(
      Array.from({ length: 50 }, (_, i) => coverPattern(`nota-${i}`).variant),
    );
    expect(variants.size).toBe(COVER_VARIANTS);
  });

  it("mantiene los nodos dentro del viewBox, con margen", () => {
    for (const node of coverPattern("bordes").nodes) {
      expect(node.x).toBeGreaterThanOrEqual(8);
      expect(node.x).toBeLessThanOrEqual(COVER_VIEWBOX.width - 8);
      expect(node.y).toBeGreaterThanOrEqual(8);
      expect(node.y).toBeLessThanOrEqual(COVER_VIEWBOX.height - 8);
    }
  });

  it("no repite aristas y cada una une dos nodos válidos", () => {
    const { nodes, edges } = coverPattern("aristas");
    const keys = edges.map(([a, b]) => `${a}-${b}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const [a, b] of edges) {
      expect(a).toBeLessThan(b);
      expect(b).toBeLessThan(nodes.length);
    }
  });
});
