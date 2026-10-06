import { del, get, put } from "@vercel/blob";
import {
  PrivateFetchResult,
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
  buildStorageKey,
  isCanonicalKey,
} from "@/lib/storage/types";

/**
 * El id del store, en minúsculas como aparece en el host de sus URLs. Sale de `BLOB_STORE_ID` o
 * del token `vercel_blob_rw_<storeId>_<secreto>` (el mismo formato que parsea `@vercel/blob`).
 * `null` si no se puede saber: entonces solo se exige el dominio de Vercel Blob.
 */
function ownStoreId(): string | null {
  const explicit = process.env.BLOB_STORE_ID?.trim();
  const fromToken = process.env.BLOB_READ_WRITE_TOKEN?.split("_")[3];
  const id = (explicit || fromToken || "").replace(/^store_/, "");
  return id ? id.toLowerCase() : null;
}

/** Vercel Blob storage. Reads BLOB_READ_WRITE_TOKEN from the environment automatically. */
export class VercelBlobStorage implements StorageProvider {
  async upload({
    buffer,
    contentType,
    folder,
    filename,
    access = "public",
  }: StorageUploadInput): Promise<StorageUploadResult> {
    const key = buildStorageKey(folder, filename);
    const blob = await put(key, buffer, {
      access,
      contentType,
      addRandomSuffix: false,
    });
    return { url: blob.url };
  }

  async remove(url: string): Promise<void> {
    await del(url);
  }

  /**
   * Solo URLs completas de un store privado de Vercel Blob. Un pathname suelto se rechaza: `get()`
   * lo resolvería contra nuestro store, y como prod y preview comparten store, un pathname
   * `prod/…` inventado en una respuesta de preview leía archivos de producción (milestone 25, S2).
   */
  privateKeyOf(url: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname.endsWith(".private.blob.vercel-storage.com") ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    // Y de **nuestro** store: si no, `get()` le mandaría nuestro token a otro store.
    const storeId = ownStoreId();
    if (
      storeId &&
      parsed.hostname !== `${storeId}.private.blob.vercel-storage.com`
    ) {
      return null;
    }
    let key: string;
    try {
      key = decodeURIComponent(parsed.pathname.slice(1));
    } catch {
      return null;
    }
    return isCanonicalKey(key) ? key : null;
  }

  async fetchPrivate(url: string): Promise<PrivateFetchResult | null> {
    if (!this.privateKeyOf(url)) return null;
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return {
      stream: result.stream,
      contentType: result.blob.contentType,
      size: result.blob.size,
    };
  }
}
