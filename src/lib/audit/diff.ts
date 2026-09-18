/**
 * Pure helpers for building audit trail entries — no server-only imports, so
 * they're safe to unit test directly and to import from client code if ever
 * needed (e.g. to preview a diff before submitting).
 */

/** `RegisteredUser` shape sufficient to build a readable actor label. */
export type ActorSource = {
  name: string;
  lastName: string;
  user: { email: string; displayEmail?: string | null };
};

export function actorLabelFor(actor: ActorSource): string {
  const fullName = `${actor.name} ${actor.lastName}`.trim();
  const email = actor.user.displayEmail || actor.user.email;
  return fullName ? `${fullName} <${email}>` : email;
}

/**
 * Shallow field-level diff over just `keys`. Returns `null` when nothing in
 * `keys` actually changed, so callers can skip writing a no-op entry.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  keys: (keyof T)[],
): {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
} | null {
  const beforeOut: Record<string, unknown> = {};
  const afterOut: Record<string, unknown> = {};
  let changed = false;
  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    if (!Object.is(b, a)) {
      changed = true;
      beforeOut[key as string] = b;
      afterOut[key as string] = a;
    }
  }
  if (!changed) return null;
  return { before: beforeOut, after: afterOut };
}
