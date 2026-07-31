/**
 * Storage abstraction for uploaded binary assets (currently event images).
 *
 * Implementations live alongside this file; `getStorage()` (./index) picks one at runtime.
 * Today: Vercel Blob in production, a local filesystem fallback for dev. A future
 * S3-compatible "custom" provider (e.g. a VPS on Coolify) only needs to implement this
 * interface and be registered in the factory — no call sites change.
 */
import { createId } from "@paralleldrive/cuid2";

export interface StorageUploadInput {
  buffer: Buffer;
  contentType: string;
  /**
   * Logical path segments identifying the owning entity, from broad to specific —
   * e.g. ["events", eventId] or ["spaces", slug]. Rendered as nested folders. The
   * environment root (prod/preview/dev) is prepended automatically; do not include it.
   */
  folder?: string[];
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

/** URL/path-safe version of a single folder segment (preserves case for ids/slugs). */
export function safeSegment(segment: string): string {
  const cleaned = segment
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "misc";
}

/**
 * Root folder isolating one deploy environment from another inside a single (shared) store.
 * Vercel Blob has one store per project across all environments, so prod and preview would
 * otherwise collide — this keeps them in separate top-level folders.
 */
export function storageEnvRoot(): string {
  switch (process.env.VERCEL_ENV) {
    case "production":
      return "prod";
    case "preview":
      return "preview";
    default:
      return "dev";
  }
}

/**
 * Builds the full storage key for an upload:
 *   <env>/<...folder>/<cuid>-<filename>
 * Shared by every provider so the layout (and env isolation) stays identical everywhere.
 */
export function buildStorageKey(
  folder: string[] | undefined,
  filename: string,
): string {
  return [
    storageEnvRoot(),
    ...(folder ?? []).map(safeSegment).filter(Boolean),
    `${createId()}-${safeFilename(filename)}`,
  ].join("/");
}
