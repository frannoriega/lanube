/**
 * Diff de textos largos para la auditoría (milestone 16): por líneas, y dentro de cada línea
 * reemplazada, por palabras — como lo muestra GitHub.
 *
 * Por qué: la descripción de un evento o el cuerpo de una noticia tienen cientos o miles de
 * caracteres. Mostrarlos enteros tachados en rojo y otra vez enteros en verde obligaba a
 * leer los dos y encontrar a ojo la coma que cambió. Acá solo se muestran las líneas que
 * cambiaron (más una de contexto alrededor), y dentro de ellas se resaltan las palabras.
 *
 * LCS clásico (programación dinámica): los textos auditados son cortos (≤ unas pocas miles
 * de palabras), así que O(n·m) sobra. Puro y seguro para el cliente.
 */

export type DiffOp = "same" | "add" | "del";

/** Un tramo de palabras dentro de una línea. */
export interface WordPart {
  op: DiffOp;
  text: string;
}

/**
 * Una fila del diff. `del`/`add` traen `parts` cuando son una línea **reemplazada** (una
 * línea borrada emparejada con una agregada), para resaltar solo las palabras que cambiaron.
 * `gap` marca líneas iguales que se omitieron (`count` cuántas).
 */
export type TextDiffLine =
  | { op: DiffOp; text: string; parts?: WordPart[] }
  | { op: "gap"; count: number };

/** Operaciones de edición de `a` a `b` (LCS), sobre cualquier secuencia de strings. */
function diffSequence(
  a: string[],
  b: string[],
): { op: DiffOp; text: string }[] {
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = largo de la subsecuencia común más larga de a[i..] y b[j..].
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: { op: DiffOp; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ op: "del", text: a[i++] });
    } else {
      out.push({ op: "add", text: b[j++] });
    }
  }
  while (i < n) out.push({ op: "del", text: a[i++] });
  while (j < m) out.push({ op: "add", text: b[j++] });
  return out;
}

/** Palabras con su espacio pegado, así al unirlas el texto queda idéntico al original. */
function tokenize(line: string): string[] {
  return line.match(/\S+\s*|\s+/g) ?? [];
}

/** Junta tramos consecutivos de la misma operación (menos `<span>` en pantalla). */
function mergeParts(parts: WordPart[]): WordPart[] {
  const out: WordPart[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && last.op === p.op) last.text += p.text;
    else out.push({ ...p });
  }
  return out;
}

/** Partes de palabras de un reemplazo de línea: las de "antes" y las de "después". */
function wordParts(
  before: string,
  after: string,
): { del: WordPart[]; add: WordPart[] } {
  const ops = diffSequence(tokenize(before), tokenize(after));
  return {
    del: mergeParts(ops.filter((o) => o.op !== "add")),
    add: mergeParts(ops.filter((o) => o.op !== "del")),
  };
}

/** Líneas de contexto que se muestran alrededor de cada cambio. */
const CONTEXT = 1;

/**
 * Diff por líneas entre dos textos, con las palabras resaltadas en las líneas reemplazadas y
 * las líneas iguales lejanas colapsadas en un `gap`.
 */
export function diffText(before: string, after: string): TextDiffLine[] {
  // Un texto vacío es "sin líneas", no "una línea vacía": si no, borrar una descripción
  // mostraba una línea verde vacía emparejada con la roja.
  const toLines = (t: string) => (t === "" ? [] : t.split("\n"));
  const raw = diffSequence(toLines(before), toLines(after));

  // Emparejar cada bloque de borradas con el bloque de agregadas que le sigue: son
  // reemplazos, y ahí vale la pena el diff por palabras.
  const lines: TextDiffLine[] = [];
  for (let k = 0; k < raw.length; ) {
    if (raw[k].op !== "del") {
      lines.push(raw[k++]);
      continue;
    }
    const dels: string[] = [];
    while (k < raw.length && raw[k].op === "del") dels.push(raw[k++].text);
    const adds: string[] = [];
    while (k < raw.length && raw[k].op === "add") adds.push(raw[k++].text);
    const pairs = Array.from(
      { length: Math.min(dels.length, adds.length) },
      (_, p) => wordParts(dels[p], adds[p]),
    );
    dels.forEach((text, p) =>
      lines.push({ op: "del", text, parts: pairs[p]?.del }),
    );
    adds.forEach((text, p) =>
      lines.push({ op: "add", text, parts: pairs[p]?.add }),
    );
  }

  // Colapsar las líneas iguales que están a más de CONTEXT de cualquier cambio.
  const near = lines.map((l, idx) => {
    if (l.op !== "same") return true;
    for (let d = -CONTEXT; d <= CONTEXT; d++) {
      const o = lines[idx + d];
      if (o && o.op !== "same") return true;
    }
    return false;
  });
  const out: TextDiffLine[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    if (near[idx]) {
      out.push(lines[idx]);
      continue;
    }
    const last = out[out.length - 1];
    if (last && last.op === "gap") last.count++;
    else out.push({ op: "gap", count: 1 });
  }
  return out;
}
