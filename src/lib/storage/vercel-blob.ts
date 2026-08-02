import { del, get, put } from "@vercel/blob";
import {
  PrivateFetchResult,
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
  buildStorageKey,
} from "@/lib/storage/types";

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

  async fetchPrivate(url: string): Promise<PrivateFetchResult | null> {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return {
      stream: result.stream,
      contentType: result.blob.contentType,
      size: result.blob.size,
    };
  }
}
