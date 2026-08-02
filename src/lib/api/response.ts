import "server-only";
import { NextResponse } from "next/server";
import { serializeJson } from "@/lib/json-bigint";
import { logger } from "@/lib/logger";
import { isDomainError } from "@/lib/errors";

/**
 * Standardized JSON responses for API routes.
 *
 * Contract:
 *   - Success bodies are the payload itself (BigInt-safe via serializeJson).
 *   - Error bodies are always `{ message: string }`, optionally with extra
 *     structured fields (e.g. Zod `issues`). The `message` is user-facing and
 *     must never contain internal error text or a stack trace.
 *
 * The matching client (`src/lib/api/client.ts`) reads `message`.
 */

/** Success payload (200 by default). Serializes BigInt → number automatically. */
export function apiSuccess<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(serializeJson(data), init);
}

/** Client-facing error with a controlled message (4xx). */
export function apiError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ message, ...extra }, { status });
}

/**
 * Unexpected server failure. Logs the real error server-side (with `context`
 * so the log is greppable to the failing route) and returns a generic 500 that
 * never leaks internals to the client. Use this in `catch` blocks.
 *
 *   } catch (err) {
 *     return apiServerError("admin/events PUT", err);
 *   }
 */
export function apiServerError(
  context: string,
  err: unknown,
  meta?: Record<string, unknown>,
): NextResponse {
  logger.error(context, err, meta);
  return NextResponse.json(
    { message: "Error interno del servidor" },
    { status: 500 },
  );
}

/**
 * Standard `catch` handler: if the failure is a {@link DomainError} (a
 * business-rule violation with a user-safe message), return it as a 4xx;
 * otherwise log it and return a generic 500. Use as:
 *
 *   } catch (err) {
 *     return apiCatch("resources POST", err);
 *   }
 */
export function apiCatch(
  context: string,
  err: unknown,
  meta?: Record<string, unknown>,
): NextResponse {
  if (isDomainError(err)) {
    return NextResponse.json({ message: err.message }, { status: err.status });
  }
  return apiServerError(context, err, meta);
}
