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
  /**
   * Access level. "public" (default) → the returned url is directly fetchable. "private" →
   * the url requires authentication; retrieve the bytes server-side via `fetchPrivate`. Used for
   * participant-uploaded form files, which must never be publicly linkable.
   */
  access?: "public" | "private";
}

export interface StorageUploadResult {
  /**
   * Locator for the stored asset. For public uploads it's a directly-fetchable URL; for private
   * uploads it's an opaque handle only `fetchPrivate` (same provider) knows how to read.
   */
  url: string;
}

/** A private asset's bytes + metadata, streamed back through an authenticated route. */
export interface PrivateFetchResult {
  stream: ReadableStream<Uint8Array>;
  contentType: string | null;
  size: number | null;
}

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  /** Best-effort deletion of a previously uploaded asset by its URL. */
  remove(url: string): Promise<void>;
  /**
   * Streams a private asset previously stored with `access: "private"`. Returns null when the
   * asset is missing or the url isn't one this provider produced. Callers must authorize first.
   */
  fetchPrivate(url: string): Promise<PrivateFetchResult | null>;
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
