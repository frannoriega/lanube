import { createId } from "@paralleldrive/cuid2";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
  safeFilename,
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
    prefix,
    filename,
  }: StorageUploadInput): Promise<StorageUploadResult> {
    const dir = prefix ? path.join(UPLOAD_ROOT, prefix) : UPLOAD_ROOT;
    await mkdir(dir, { recursive: true });
    const name = `${createId()}-${safeFilename(filename)}`;
    await writeFile(path.join(dir, name), buffer);
    return { url: `/uploads/${prefix ? `${prefix}/` : ""}${name}` };
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith("/uploads/")) return;
    const rel = url.replace(/^\/uploads\//, "");
    await unlink(path.join(UPLOAD_ROOT, rel)).catch(() => {});
  }
}
