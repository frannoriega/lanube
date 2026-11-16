#!/usr/bin/env node
/**
 * Manifiesto del build (milestone 28). Corre **después** de `next build` (lo llama
 * `deploy/Dockerfile`) y escribe el SHA-256 de cada archivo de `.next/static` — lo que el sitio
 * sirve en `/_next/static/...` a cualquier navegador — más la versión, el commit y la hora.
 *
 *   node scripts/release-manifest.mjs <salida.json>
 *
 * La app lo devuelve en `GET /api/version` y `scripts/verify-deployment.mjs` lo compara contra
 * los archivos que sirve el sitio en vivo. Como la imagen que construye CI lleva este archivo
 * adentro, la imagen publicada en GHCR para un commit es la **referencia** de qué debería
 * servir un despliegue de ese commit.
 *
 * Sin dependencias: corre en la etapa `builder` con solo Node.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const out = process.argv[2];
if (!out) {
  console.error("uso: node scripts/release-manifest.mjs <salida.json>");
  process.exit(2);
}

const STATIC_DIR = path.join(process.cwd(), ".next/static");

/** Todos los archivos bajo `dir`, como rutas relativas con `/`. */
function walk(dir, base = dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full, base));
    else files.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return files;
}

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

const files = {};
for (const rel of walk(STATIC_DIR).sort()) {
  files[`/_next/static/${rel}`] = sha256(
    readFileSync(path.join(STATIC_DIR, rel)),
  );
}

// Huella de todo el conjunto: las líneas "<ruta> <hash>" ordenadas, una por archivo.
const staticDigest = sha256(
  Object.entries(files)
    .map(([p, h]) => `${p} ${h}\n`)
    .join(""),
);

const pkg = JSON.parse(
  readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
);
const commit = /^[0-9a-f]{40}$/.test(process.env.APP_COMMIT_SHA ?? "")
  ? process.env.APP_COMMIT_SHA
  : null;

const manifest = {
  schema: 1,
  version: pkg.version,
  commit,
  builtAt: new Date().toISOString(),
  staticDigest,
  files,
};

writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `release-manifest: v${manifest.version} ${commit ?? "(sin commit)"} — ${Object.keys(files).length} archivos, huella ${staticDigest.slice(0, 16)}…`,
);
