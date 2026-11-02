/**
 * Exporta los archivos de Vercel Blob (prefijo `prod/`) a una carpeta local para subirlos al VPS.
 *
 *   npx tsx scripts/export-blob.ts --out ./blob-export [--dry-run]
 *
 * Necesita `BLOB_READ_WRITE_TOKEN` en el entorno (`vercel env pull .env.vercel` y exportarlo).
 * Solo LEE de Blob. Incremental: lo ya descargado con el mismo tamaño se saltea, así la segunda
 * pasada (el corte final) baja solo lo nuevo.
 *
 * Layout de salida = el del proveedor `local` del VPS (`STORAGE_LOCAL_DIR`):
 *   <out>/public/<clave>   ← blobs de host `*.public.blob.vercel-storage.com`
 *   <out>/private/<clave>  ← blobs de host `*.private.blob.vercel-storage.com`
 * Después: rsync a `~/blob-import/` en el VPS y, allá, `sudo rsync -a --chown=1000:1000` al volumen.
 * La verificación definitiva es `lanube-verify-uploads` en el VPS (contrasta con la base).
 */
import { createWriteStream } from "fs";
import { mkdir, stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { get, list } from "@vercel/blob";

const PREFIX = "prod/";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const outIdx = args.indexOf("--out");
const out = path.resolve(outIdx >= 0 ? args[outIdx + 1] : "./blob-export");

/** Misma regla que `isCanonicalKey` del proveedor: nada de `..`, vacíos ni barras invertidas. */
function canonical(key: string): boolean {
  return (
    !!key &&
    !key.includes("\\") &&
    key.split("/").every((s) => s !== "" && s !== "." && s !== "..")
  );
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Falta BLOB_READ_WRITE_TOKEN en el entorno");
  }
  const blobs: { url: string; pathname: string; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, limit: 1000, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const isPrivate = (url: string) =>
    new URL(url).hostname.endsWith(".private.blob.vercel-storage.com");
  const nPriv = blobs.filter((b) => isPrivate(b.url)).length;
  const bytes = blobs.reduce((n, b) => n + b.size, 0);
  console.log(
    `${blobs.length} archivos (${nPriv} privados, ${blobs.length - nPriv} públicos), ${(bytes / 1e6).toFixed(1)} MB`,
  );
  if (dryRun) return;

  let done = 0;
  let skipped = 0;
  const failures: string[] = [];
  const queue = [...blobs];
  const worker = async () => {
    for (let b = queue.shift(); b; b = queue.shift()) {
      try {
        if (!canonical(b.pathname)) throw new Error("clave no canónica");
        const dest = path.join(
          out,
          isPrivate(b.url) ? "private" : "public",
          b.pathname,
        );
        const have = await stat(dest).catch(() => null);
        if (have && have.size === b.size) {
          skipped++;
          continue;
        }
        // 0700/0600: la carpeta tiene adjuntos de participantes (datos personales).
        await mkdir(path.dirname(dest), { recursive: true, mode: 0o700 });
        let body: ReadableStream<Uint8Array> | null;
        if (isPrivate(b.url)) {
          const r = await get(b.url, { access: "private" });
          if (!r || r.statusCode !== 200) throw new Error("no se pudo leer");
          body = r.stream;
        } else {
          const r = await fetch(b.url);
          if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
          body = r.body;
        }
        await pipeline(
          Readable.fromWeb(body as import("stream/web").ReadableStream),
          createWriteStream(dest, { mode: 0o600 }),
        );
        done++;
      } catch (e) {
        failures.push(`${b.pathname}: ${(e as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(
    `Descargados ${done}, ya estaban ${skipped}, fallidos ${failures.length}`,
  );
  failures.slice(0, 25).forEach((f) => console.log("FALLÓ:", f));
  if (failures.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
