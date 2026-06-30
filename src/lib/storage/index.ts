import { LocalStorage } from "@/lib/storage/local";
import { StorageProvider } from "@/lib/storage/types";
import { VercelBlobStorage } from "@/lib/storage/vercel-blob";

export type { StorageProvider } from "@/lib/storage/types";

/**
 * Resolves the active storage provider. Selection precedence:
 *   1. STORAGE_PROVIDER env ("vercel-blob" | "local") — explicit override.
 *   2. Otherwise: Vercel Blob when BLOB_READ_WRITE_TOKEN is set, else the local fallback.
 *
 * Add a future "custom"/S3 provider here.
 */
export function getStorage(): StorageProvider {
  const provider =
    process.env.STORAGE_PROVIDER ??
    (process.env.BLOB_READ_WRITE_TOKEN ? "vercel-blob" : "local");

  switch (provider) {
    case "vercel-blob":
      return new VercelBlobStorage();
    case "local":
      return new LocalStorage();
    default:
      throw new Error(`Proveedor de almacenamiento desconocido: ${provider}`);
  }
}
