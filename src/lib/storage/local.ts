import { createReadStream } from "fs";
import { mkdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import {
  PrivateFetchResult,
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
  buildStorageKey,
} from "@/lib/storage/types";

const PUBLIC_ROOT = path.join(process.cwd(), "public", "uploads");
// Private assets live outside public/ so they're never served statically; they're read back only
// through fetchPrivate (behind an authenticated route). Keyed by the "local-private:" url scheme.
const PRIVATE_ROOT = path.join(process.cwd(), ".private-uploads");
const PRIVATE_SCHEME = "local-private:";

// Minimal extension → MIME map for private reads (the browser's reported type isn't stored here).
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * Filesystem-backed storage for local development. Public files go under public/uploads (served at
 * /uploads/...); private files go under .private-uploads and are streamed back via fetchPrivate.
 * Not suitable for serverless/Vercel — use the Blob provider there.
 */
export class LocalStorage implements StorageProvider {
  async upload({
    buffer,
    folder,
    filename,
    access = "public",
  }: StorageUploadInput): Promise<StorageUploadResult> {
    const key = buildStorageKey(folder, filename);
    const root = access === "private" ? PRIVATE_ROOT : PUBLIC_ROOT;
    const dest = path.join(root, key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
    return {
      url: access === "private" ? `${PRIVATE_SCHEME}${key}` : `/uploads/${key}`,
    };
  }

  async remove(url: string): Promise<void> {
    if (url.startsWith(PRIVATE_SCHEME)) {
      const rel = url.slice(PRIVATE_SCHEME.length);
      await unlink(path.join(PRIVATE_ROOT, rel)).catch(() => {});
      return;
    }
    if (!url.startsWith("/uploads/")) return;
    const rel = url.replace(/^\/uploads\//, "");
    await unlink(path.join(PUBLIC_ROOT, rel)).catch(() => {});
  }

  async fetchPrivate(url: string): Promise<PrivateFetchResult | null> {
    if (!url.startsWith(PRIVATE_SCHEME)) return null;
    const rel = url.slice(PRIVATE_SCHEME.length);
    const abs = path.join(PRIVATE_ROOT, rel);
    try {
      const info = await stat(abs);
      const ext = path.extname(abs).slice(1).toLowerCase();
      return {
        stream: Readable.toWeb(
          createReadStream(abs),
        ) as ReadableStream<Uint8Array>,
        contentType: MIME_BY_EXT[ext] ?? "application/octet-stream",
        size: info.size,
      };
    } catch {
      return null;
    }
  }
}
