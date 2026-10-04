import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { z } from "zod";
import { isAcceptableCimdUrl, isPrivateAddress } from "./ssrf";

/**
 * Trae y valida un **Client ID Metadata Document** (milestone 20). Con CIMD, el `client_id`
 * de un asistente es una URL https que devuelve su metadata (`client_name`,
 * `redirect_uris`…); es la forma de registro preferida desde la revisión 2026-07-28 de MCP.
 *
 * Como la URL la elige un tercero, el fetch va blindado contra SSRF:
 *
 * - solo `https`, sin credenciales ni puertos raros (`isAcceptableCimdUrl`);
 * - la IP se valida **en el momento de conectar** (opción `lookup` de `https.request`), no
 *   con un DNS previo aparte: así un dominio que resuelve a una IP pública al chequear y a
 *   `169.254.169.254` al conectar (DNS rebinding) igual se rechaza;
 * - sin seguir redirects, timeout de 5 s, y como mucho 64 KB de respuesta.
 */

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BYTES = 64 * 1024;

/** Lo que nos importa del documento (RFC 7591 §2 + el borrador de CIMD). */
const cimdSchema = z.object({
  client_id: z.string(),
  client_name: z.string().trim().min(1).max(200).optional(),
  redirect_uris: z.array(z.string()).min(1).max(20),
  logo_uri: z.string().url().optional(),
  token_endpoint_auth_method: z.string().optional(),
});

export type CimdDocument = z.infer<typeof cimdSchema>;

export class CimdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CimdError";
  }
}

/** `dns.lookup` que se niega a devolver una dirección privada. */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => isPrivateAddress(a.address));
    if (bad || list.length === 0) {
      return callback(
        new CimdError("El documento del cliente apunta a una red privada"),
        "",
        0,
      );
    }
    if ((options as { all?: boolean }).all) {
      return (callback as unknown as (e: null, a: LookupAddress[]) => void)(
        null,
        list,
      );
    }
    callback(null, list[0].address, list[0].family);
  });
};

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        lookup: safeLookup,
        timeout: FETCH_TIMEOUT_MS,
        headers: { accept: "application/json" },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(
            new CimdError(
              `El documento del cliente respondió ${res.statusCode ?? "sin estado"}`,
            ),
          );
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy(
              new CimdError("El documento del cliente es demasiado grande"),
            );
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      },
    );
    req.on("timeout", () =>
      req.destroy(new CimdError("El documento del cliente tardó demasiado")),
    );
    req.on("error", reject);
  });
}

/**
 * Trae el documento de `clientId` y lo valida. Tira {@link CimdError} con un motivo legible
 * si algo no cierra; en particular, el `client_id` del documento **tiene que ser igual** a
 * la URL de la que se trajo (si no, un documento podría hacerse pasar por otro cliente).
 */
export async function fetchCimdDocument(
  clientId: string,
): Promise<CimdDocument> {
  if (!isAcceptableCimdUrl(clientId))
    throw new CimdError("El client_id no es una URL https válida");
  let body: string;
  try {
    body = await fetchText(clientId);
  } catch (err) {
    if (err instanceof CimdError) throw err;
    throw new CimdError("No pudimos obtener el documento del cliente");
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new CimdError("El documento del cliente no es JSON válido");
  }
  const parsed = cimdSchema.safeParse(json);
  if (!parsed.success)
    throw new CimdError(
      "El documento del cliente no tiene el formato esperado",
    );
  if (parsed.data.client_id !== clientId)
    throw new CimdError("El client_id del documento no coincide con su URL");
  return parsed.data;
}
