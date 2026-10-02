/**
 * Patrón generativo para la portada de una noticia sin imagen: una pequeña "red de nodos"
 * (el mismo motivo que el fondo del sitio) sobre uno de varios degradés de marca.
 *
 * Es **determinístico por slug**: la misma nota siempre dibuja la misma red y el mismo
 * degradé — en el listado, en el landing y en el riel del detalle — y dos notas distintas
 * casi nunca coinciden, así que una fila de notas sin portada no se ve como cuatro copias
 * del mismo placeholder. Es una función pura (sin `Math.random`), por lo que renderiza igual
 * en el servidor y en el cliente y se puede testear.
 */

/** Ancho/alto del `viewBox` del SVG; el componente lo estira con `preserveAspectRatio`. */
export const COVER_VIEWBOX = { width: 160, height: 100 } as const;

/** Cantidad de degradés de marca entre los que elige el patrón (ver `NewsCover`). */
export const COVER_VARIANTS = 4;

const NODE_COUNT = 11;
/** Cada nodo se une a sus N vecinos más cercanos — da una red conexa sin volverse maraña. */
const NEIGHBORS = 2;

export interface CoverNode {
  x: number;
  y: number;
  /** Radio del punto; unos pocos nodos "hub" son más grandes. */
  r: number;
}

export interface CoverPattern {
  /** Índice del degradé, en `[0, COVER_VARIANTS)`. */
  variant: number;
  nodes: CoverNode[];
  /** Pares de índices en `nodes`, sin duplicados (`[a, b]` con `a < b`). */
  edges: [number, number][];
}

/** FNV-1a de 32 bits: hash chico y estable para sembrar el generador. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: PRNG sembrado, suficiente para decorar (no es criptográfico). */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Genera el patrón de portada para una nota a partir de su slug. */
export function coverPattern(seed: string): CoverPattern {
  const h = hash(seed);
  const next = rng(h);
  const { width, height } = COVER_VIEWBOX;

  // Los nodos se reparten con un margen para que ningún punto quede cortado en el borde.
  const nodes: CoverNode[] = Array.from({ length: NODE_COUNT }, () => ({
    x: Math.round((8 + next() * (width - 16)) * 10) / 10,
    y: Math.round((8 + next() * (height - 16)) * 10) / 10,
    r: next() < 0.25 ? 2.6 : 1.5,
  }));

  const seen = new Set<string>();
  const edges: [number, number][] = [];
  nodes.forEach((node, i) => {
    const nearest = nodes
      .map((other, j) => ({
        j,
        d: (other.x - node.x) ** 2 + (other.y - node.y) ** 2,
      }))
      .filter(({ j }) => j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, NEIGHBORS);
    for (const { j } of nearest) {
      const edge: [number, number] = i < j ? [i, j] : [j, i];
      const key = edge.join("-");
      if (!seen.has(key)) {
        seen.add(key);
        edges.push(edge);
      }
    }
  });

  return { variant: h % COVER_VARIANTS, nodes, edges };
}
