import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
  buildStorageKey,
} from "@/lib/storage/types";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

/**
 * Filesystem-backed storage for local development. Writes under public/uploads so files
 * are served from the same origin at /uploads/... (not suitable for serverless/Vercel —
 * use the Blob provider there).
 */
export class LocalStorage implements StorageProvider {
  async upload({
    buffer,
    folder,
    filename,
  }: StorageUploadInput): Promise<StorageUploadResult> {
    const key = buildStorageKey(folder, filename);
    const dest = path.join(UPLOAD_ROOT, key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
    return { url: `/uploads/${key}` };
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith("/uploads/")) return;
    const rel = url.replace(/^\/uploads\//, "");
    await unlink(path.join(UPLOAD_ROOT, rel)).catch(() => {});
  }
}
