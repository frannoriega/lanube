/**
 * Guarda de versión (milestone 28): **no se despliega código nuevo con un número de versión
 * viejo.** Corre en CI antes de construir (`.github/workflows/deploy.yml`) y a mano con
 * `npm run release:check`.
 *
 * Cómo decide, con la versión de `package.json` (que `registry.test.ts` ata a la última
 * entrada de `src/lib/changelog/registry.ts`):
 *
 * - Si ya existe el tag `v<versión>`, esa versión **ya se publicó**. Si desde ese tag cambió
 *   algo de lo que termina en el servidor (`APP_PATHS`), falla: hay que subir la versión y
 *   escribir su entrada de novedades. Cambios solo en documentación, tests o el changelog
 *   pasan (no cambian lo que corre).
 * - Si no existe, es una versión nueva: tiene que ser el siguiente salto semver del último
 *   tag publicado (`1.0.0` → `1.0.1`, `1.1.0` o `2.0.0`). CI crea el tag al publicar.
 *
 *   npx tsx scripts/check-release.ts           # falla (exit 1) si hay un problema
 *   npx tsx scripts/check-release.ts --warn    # solo avisa (exit 0), para usar en ramas
 *
 * Los tags son la memoria de qué se publicó: hacen falta en el clon (`fetch-depth: 0`).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  compareSemver,
  isNextVersion,
  isSemver,
  parseSemver,
} from "../src/lib/changelog/semver";

/**
 * Lo que termina en la imagen del servidor. Un cambio acá sin versión nueva frena el deploy.
 * Si se agrega algo que cambia lo que corre (un archivo de config nuevo en la raíz, por
 * ejemplo), va en esta lista.
 */
const APP_PATHS = [
  "src",
  "prisma",
  "public",
  "package.json",
  "package-lock.json",
  ".npmrc",
  "next.config.ts",
  "prisma.config.ts",
  "tsconfig.json",
  "postcss.config.mjs",
  "tailwind.config.ts",
  "deploy/Dockerfile",
  "scripts/release-manifest.mjs",
];

/** Dentro de `APP_PATHS`, lo que no cambia lo que corre. */
const EXCLUDED = [
  ":(exclude,glob)**/*.test.ts",
  ":(exclude,glob)**/*.test.tsx",
  // Corregir una errata en una entrada vieja no es una versión nueva.
  ":(exclude)src/assets/changelog",
];

const warnOnly = process.argv.includes("--warn");
const inCI = process.env.GITHUB_ACTIONS === "true";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fail(message: string): never {
  if (inCI) console.log(`::${warnOnly ? "warning" : "error"}::${message}`);
  console.error(`${warnOnly ? "⚠" : "✗"} ${message}`);
  process.exit(warnOnly ? 0 : 1);
}

const pkg = JSON.parse(
  readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
) as { version: string };
const version = pkg.version;

if (!isSemver(version))
  fail(`package.json tiene una versión inválida: "${version}".`);

if (git("rev-parse", "--is-shallow-repository") === "true")
  fail(
    "El clon es superficial: la guarda necesita el historial y los tags (fetch-depth: 0).",
  );

const released = git("tag", "--list", "v*")
  .split("\n")
  .map((t) => t.trim().replace(/^v/, ""))
  .filter(isSemver)
  .sort((a, b) => compareSemver(b, a));

if (released.includes(version)) {
  const changed = git(
    "diff",
    "--name-only",
    `v${version}`,
    "HEAD",
    "--",
    ...APP_PATHS,
    ...EXCLUDED,
  )
    .split("\n")
    .filter(Boolean);
  if (changed.length > 0) {
    const list = changed.slice(0, 15).join(", ");
    const more = changed.length > 15 ? ` y ${changed.length - 15} más` : "";
    fail(
      `La versión ${version} ya se publicó (tag v${version}) y desde entonces cambió lo que se despliega ` +
        `(${list}${more}). Subí la versión (package.json + una entrada nueva en src/lib/changelog/registry.ts ` +
        `con su src/assets/changelog/<versión>.md).`,
    );
  }
  console.log(
    `✓ ${version} ya publicada y sin cambios de app desde v${version} (solo docs/tests).`,
  );
} else {
  const latest = released[0];
  if (latest && compareSemver(version, latest) < 0)
    fail(`La versión ${version} es menor que la última publicada (${latest}).`);
  if (latest && !isNextVersion(latest, version)) {
    const p = parseSemver(latest)!;
    fail(
      `${latest} → ${version} no es el siguiente salto: puede ser ${p.major}.${p.minor}.${p.patch + 1} (arreglos), ` +
        `${p.major}.${p.minor + 1}.0 (algo nuevo) o ${p.major + 1}.0.0 (cambio incompatible).`,
    );
  }
  console.log(
    `✓ ${version} es una versión nueva${latest ? ` (la anterior: ${latest})` : " (la primera)"}: CI crea el tag v${version} al publicar.`,
  );
}
