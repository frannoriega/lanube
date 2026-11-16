#!/usr/bin/env node
/**
 * ¿El sitio en vivo es el que se construyó desde el repositorio? (milestone 28)
 *
 *   node scripts/verify-deployment.mjs https://lanube.example
 *   node scripts/verify-deployment.mjs https://lanube.example --reference ./release-manifest.json
 *   node scripts/verify-deployment.mjs https://lanube.example --image ghcr.io/frannoriega/lanube
 *
 * Qué hace, de lo más débil a lo más fuerte:
 *
 * 1. **Lo que dice el servidor** — `GET /api/version?files=1`: versión, commit, huella de los
 *    archivos estáticos. Es autodeclarado: un servidor modificado puede mentir acá.
 * 2. **El commit existe y es público** — está en `origin/main` de este clon y su
 *    `package.json` dice la misma versión (hace `git fetch` antes de mirar).
 * 3. **La referencia** — el `release-manifest.json` de la imagen que CI construyó y publicó en
 *    GHCR para ese commit (`docker pull` + `docker cp`), o uno que se pase con `--reference`.
 *    Si está `gh`, además verifica la atestación de procedencia firmada de esa imagen
 *    (`gh attestation verify`): prueba que la construyó el workflow de este repo, en ese commit.
 * 4. **Lo que de verdad se puede comprobar desde afuera** — descarga del sitio en vivo cada
 *    archivo de `/_next/static` que lista la referencia y compara su SHA-256, y recorre algunas
 *    páginas públicas buscando scripts/estilos que **no** estén en la referencia. Esto no
 *    depende de lo que el servidor declare.
 *
 * Límite que ningún script puede saltar: el código que corre **solo en el servidor** (rutas de
 * API, consultas, lo que se hace con los datos) no es visible desde afuera. Un cambio ahí sin
 * tocar el JavaScript del navegador no se detecta con esto. Ver el doc del milestone 28.
 *
 * Salida: 0 = coincide, 1 = no coincide (hay evidencia de un build distinto), 2 = no se pudo
 * concluir (faltó la referencia, el sitio no respondió, etc.). Sin dependencias: Node ≥ 18.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith("--"))?.replace(/\/+$/, "");
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!base || !/^https?:\/\//.test(base)) {
  console.error(
    "uso: node scripts/verify-deployment.mjs <url-del-sitio> [--reference manifest.json] [--image ghcr.io/owner/repo]",
  );
  process.exit(2);
}
const IMAGE = opt("image") ?? "ghcr.io/frannoriega/lanube";
const REPO = IMAGE.replace(/^ghcr\.io\//, "");
// Páginas públicas que se recorren buscando recursos que no estén en la referencia.
const PAGES = ["/", "/spaces", "/news", "/about", "/changelog", "/auth/signin"];

const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => console.log(`  ✗ ${m}`);
const info = (m) => console.log(`  · ${m}`);
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const UA = { "user-agent": "lanube-verify-deployment" };

let mismatch = false;
let inconclusive = false;

function tryRun(cmd, cmdArgs) {
  try {
    return execFileSync(cmd, cmdArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

// --- 1. Lo que dice el servidor -------------------------------------------------------------
console.log(`\n1. Lo que declara ${base}`);
let reported;
try {
  const res = await fetch(`${base}/api/version?files=1`, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  reported = await res.json();
} catch (err) {
  bad(
    `no respondió /api/version (${err.message}). Sin eso no hay nada que comparar.`,
  );
  process.exit(2);
}
info(
  `versión ${reported.version}, commit ${reported.commit ?? "(no informa)"}`,
);
info(
  `construido ${reported.builtAt ?? "(no informa)"}, código: ${reported.source}`,
);
if (!reported.commit) {
  bad("el servidor no informa de qué commit salió: no se puede verificar.");
  process.exit(2);
}
const commit = reported.commit;

// --- 2. El commit es público ----------------------------------------------------------------
console.log("\n2. El commit en el repositorio público");
if (tryRun("git", ["rev-parse", "--git-dir"]) === null) {
  info("no estoy en un clon del repo: me salteo esta parte.");
  inconclusive = true;
} else {
  tryRun("git", ["fetch", "--quiet", "--tags", "origin"]);
  if (tryRun("git", ["cat-file", "-e", `${commit}^{commit}`]) === null) {
    bad(
      `el commit ${commit} no existe en el repositorio: el código que corre no está publicado.`,
    );
    mismatch = true;
  } else {
    if (
      tryRun("git", ["merge-base", "--is-ancestor", commit, "origin/main"]) !==
      null
    )
      ok("el commit está en origin/main.");
    else {
      bad(
        "el commit existe pero no está en origin/main (no pasó por la rama que se despliega).",
      );
      mismatch = true;
    }
    const pkgAt = tryRun("git", ["show", `${commit}:package.json`]);
    const versionAt = pkgAt ? JSON.parse(pkgAt).version : null;
    if (versionAt === reported.version)
      ok(`en ese commit, package.json dice ${versionAt}.`);
    else {
      bad(
        `en ese commit, package.json dice ${versionAt}, no ${reported.version}.`,
      );
      mismatch = true;
    }
  }
}

// --- 3. La referencia: el manifiesto del build de CI ----------------------------------------
console.log("\n3. La referencia (build de CI)");
let reference = null;
const refPath = opt("reference");
if (refPath) {
  reference = JSON.parse(readFileSync(refPath, "utf8"));
  info(`usando ${refPath}`);
} else if (
  tryRun("docker", ["version", "--format", "{{.Client.Version}}"]) !== null
) {
  const ref = `${IMAGE}:${commit}`;
  info(`docker pull ${ref}`);
  if (tryRun("docker", ["pull", "--quiet", ref]) === null) {
    bad(
      `no existe (o no se puede bajar) la imagen ${ref}: CI no construyó ese commit, o el paquete no es público.`,
    );
    inconclusive = true;
  } else {
    const dir = mkdtempSync(path.join(tmpdir(), "lanube-verify-"));
    const id = tryRun("docker", ["create", ref]);
    try {
      if (
        id &&
        tryRun("docker", ["cp", `${id}:/app/release-manifest.json`, dir]) !==
          null
      )
        reference = JSON.parse(
          readFileSync(path.join(dir, "release-manifest.json"), "utf8"),
        );
      else
        bad(
          "la imagen no trae release-manifest.json (es anterior al milestone 28).",
        );
    } finally {
      if (id) tryRun("docker", ["rm", id]);
      rmSync(dir, { recursive: true, force: true });
    }
    if (tryRun("gh", ["--version"]) !== null) {
      const att = tryRun("gh", [
        "attestation",
        "verify",
        `oci://${ref}`,
        "--repo",
        REPO,
      ]);
      if (att !== null)
        ok(
          `atestación de procedencia válida: la imagen la construyó ${REPO} (GitHub Actions).`,
        );
      else
        info(
          "no se pudo verificar la atestación de la imagen (gh sin sesión, o imagen sin atestar).",
        );
    }
  }
} else {
  info(
    "no hay docker ni --reference: no puedo comparar contra el build de CI.",
  );
}

if (!reference) {
  console.log(
    "\nSin referencia no puedo comprobar el contenido. Resultado: NO CONCLUYENTE.",
  );
  process.exit(2);
}
if (reference.commit !== commit) {
  bad(`la referencia es del commit ${reference.commit}, no de ${commit}.`);
  process.exit(2);
}
ok(
  `${Object.keys(reference.files).length} archivos, huella ${reference.staticDigest.slice(0, 16)}…`,
);
if (reported.staticDigest === reference.staticDigest)
  ok("la huella que declara el servidor coincide con la del build de CI.");
else {
  bad(
    `la huella que declara el servidor (${String(reported.staticDigest).slice(0, 16)}…) no es la del build de CI.`,
  );
  mismatch = true;
}

// --- 4. Lo que sirve el sitio, comprobado sin creerle --------------------------------------
console.log("\n4. Los archivos que el sitio le sirve a cualquier navegador");
const entries = Object.entries(reference.files);
let same = 0;
const differing = [];
const queue = [...entries];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const [file, hash] = e;
      try {
        const res = await fetch(`${base}${file}`, { headers: UA });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const got = sha256(Buffer.from(await res.arrayBuffer()));
        if (got === hash) same++;
        else differing.push(`${file} (distinto)`);
      } catch (err) {
        differing.push(`${file} (${err.message})`);
      }
    }
  }),
);
if (differing.length === 0)
  ok(`los ${same} archivos son idénticos byte a byte al build de CI.`);
else {
  bad(`${differing.length} de ${entries.length} archivos no coinciden:`);
  differing.slice(0, 10).forEach((d) => info(d));
  mismatch = true;
}

const known = new Set(Object.keys(reference.files));
const foreign = new Set();
for (const page of PAGES) {
  try {
    const res = await fetch(`${base}${page}`, {
      headers: UA,
      redirect: "follow",
    });
    const html = await res.text();
    // Las rutas de los chunks llevan paréntesis (`app/(public)/page-….js`): no cortar en `)`.
    // Sí en comillas, espacios, `<`/`>`, la barra invertida del payload RSC y la query string.
    for (const m of html.matchAll(/\/_next\/static\/[^"'\s<>\\?#]+/g))
      if (!known.has(m[0])) foreign.add(`${m[0]} (en ${page})`);
  } catch {
    info(`no pude leer ${page}`);
  }
}
if (foreign.size === 0)
  ok(`las páginas ${PAGES.join(", ")} solo cargan recursos del build de CI.`);
else {
  bad("hay páginas que cargan recursos que no están en el build de CI:");
  [...foreign].slice(0, 10).forEach((f) => info(f));
  mismatch = true;
}

// --- Veredicto ------------------------------------------------------------------------------
console.log("");
if (mismatch) {
  console.log(
    "Resultado: NO COINCIDE. Hay evidencia de que lo que corre no es el build de CI de ese commit.",
  );
  console.log(
    `Guardá esta salida con la fecha (${new Date().toISOString()}) como constancia.`,
  );
  process.exit(1);
}
if (inconclusive) {
  console.log(
    "Resultado: el contenido coincide, pero alguna verificación no se pudo hacer (ver arriba).",
  );
  process.exit(2);
}
console.log(
  "Resultado: COINCIDE. Todo lo que el sitio envía al navegador es el build de CI del commit publicado.",
);
console.log(
  "Recordá: el código que corre solo en el servidor no se puede verificar desde afuera.",
);
