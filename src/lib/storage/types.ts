/**
 * Storage abstraction for uploaded binary assets (currently event images).
 *
 * Implementations live alongside this file; `getStorage()` (./index) picks one at runtime.
 * Today: Vercel Blob in production, a local filesystem fallback for dev. A future
 * S3-compatible "custom" provider (e.g. a VPS on Coolify) only needs to implement this
 * interface and be registered in the factory — no call sites change.
 */
export interface StorageUploadInput {
  buffer: Buffer;
  contentType: string;
  /** Logical folder prefix, e.g. "events". */
  prefix?: string;
  /** Original filename — used to derive an extension. */
  filename: string;
}

export interface StorageUploadResult {
  /** Publicly accessible URL for the stored asset. */
  url: string;
}

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  /** Best-effort deletion of a previously uploaded asset by its URL. */
  remove(url: string): Promise<void>;
}

/** Lowercased, filesystem/URL-safe version of an uploaded filename. */
export function safeFilename(filename: string): string {
  const cleaned = filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "file";
}
