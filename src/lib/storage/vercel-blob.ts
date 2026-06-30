import { createId } from "@paralleldrive/cuid2";
import { del, put } from "@vercel/blob";
import {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
  safeFilename,
} from "@/lib/storage/types";

/** Vercel Blob storage. Reads BLOB_READ_WRITE_TOKEN from the environment automatically. */
export class VercelBlobStorage implements StorageProvider {
  async upload({
    buffer,
    contentType,
    prefix,
    filename,
  }: StorageUploadInput): Promise<StorageUploadResult> {
    const key = `${prefix ? `${prefix}/` : ""}${createId()}-${safeFilename(filename)}`;
    const blob = await put(key, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return { url: blob.url };
  }

  async remove(url: string): Promise<void> {
    await del(url);
  }
}
