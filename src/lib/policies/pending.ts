import { startOfDateKeyMs } from "@/lib/admin/admin-timezone";
import type { PolicyDefinition, PolicyVersion } from "./registry";

/**
 * Qué políticas tiene que aceptar un usuario (milestone 19). **Lógica pura**: recibe el
 * registro, las aceptaciones del usuario y el "ahora", así se testea sin base ni reloj (ver
 * `pending.test.ts`). La usan el alta (con cero aceptaciones), el callback `jwt()` (para el
 * gate) y la pantalla `/policies/accept`.
 *
 * La regla, por política:
 *
 * 1. La versión **vigente** `V` es la última con `effectiveAt <= ahora`. Si no hay ninguna,
 *    o `V` no exige aceptación, no hay nada pendiente.
 * 2. La versión **exigida** `R` es la más reciente `≤ V` que "dispara" una aceptación: exige
 *    aceptación y, o bien es un cambio sustancial (`reacceptance: "required"`), o bien es la
 *    primera en exigirla (la anterior era informativa, o no hay anterior).
 * 3. Está pendiente si el usuario no aceptó **ninguna versión `≥ R`**.
 * 4. Lo que se le pide aceptar es siempre `V`, aunque lo que dispare el pedido sea `R`: una
 *    errata posterior a un cambio sustancial no lo deja aceptando un texto viejo.
 */

/** Lo mínimo de una aceptación guardada que necesita la regla. */
export interface AcceptanceRecord {
  policyKey: string;
  version: string;
}

/** Una política que el usuario tiene que aceptar, con lo que la UI necesita para mostrarla. */
export interface PendingPolicy {
  key: string;
  slug: string;
  title: string;
  /** La versión vigente: la que se acepta. */
  version: string;
  effectiveAt: string;
  sha256: string;
  /**
   * La última versión de esta política que el usuario aceptó, o `null` si nunca aceptó
   * ninguna. Con ella la pantalla elige entre "Actualizamos…" y "Antes de seguir…", y arma
   * el diff "Ver qué cambió".
   */
  previouslyAccepted: string | null;
  /**
   * Los resúmenes de cambios de cada versión posterior a la que aceptó, de la más vieja a la
   * más nueva (vacío si nunca aceptó: no hay "cambios" respecto de nada).
   */
  changes: { version: string; summary: string[] }[];
}

/** Instante (ms) desde el que rige una versión: las 00:00 de su fecha en la zona del predio. */
export function effectiveAtMs(version: Pick<PolicyVersion, "effectiveAt">) {
  return startOfDateKeyMs(version.effectiveAt);
}

/** Índice de la versión vigente a `nowMs`, o `-1` si todavía no rige ninguna. */
export function currentVersionIndex(
  policy: PolicyDefinition,
  nowMs: number,
): number {
  let current = -1;
  policy.versions.forEach((v, i) => {
    if (effectiveAtMs(v) <= nowMs) current = i;
  });
  return current;
}

/** La versión vigente a `nowMs`, o `null`. */
export function currentVersion(
  policy: PolicyDefinition,
  nowMs: number,
): PolicyVersion | null {
  const i = currentVersionIndex(policy, nowMs);
  return i >= 0 ? policy.versions[i] : null;
}

/** Si la versión `i` dispara una aceptación (regla 2 de arriba). */
function triggersAcceptance(policy: PolicyDefinition, i: number): boolean {
  const v = policy.versions[i];
  if (!v.requiresAcceptance) return false;
  if (v.reacceptance === "required") return true;
  return !policy.versions[i - 1]?.requiresAcceptance;
}

/**
 * Las políticas pendientes de aceptar para un usuario con estas `acceptances`, en el orden
 * del registro. Con `acceptances = []` da lo que hay que aceptar en el alta.
 *
 * Las aceptaciones de versiones que el registro no conoce (no debería pasar: los ids nunca se
 * renombran) se ignoran.
 */
export function pendingPolicies(
  registry: Record<string, PolicyDefinition>,
  acceptances: readonly AcceptanceRecord[],
  nowMs: number,
): PendingPolicy[] {
  const out: PendingPolicy[] = [];
  for (const [key, policy] of Object.entries(registry)) {
    const cur = currentVersionIndex(policy, nowMs);
    if (cur < 0 || !policy.versions[cur].requiresAcceptance) continue;

    let required = cur;
    while (required > 0 && !triggersAcceptance(policy, required)) required--;

    // La versión más nueva (por posición en el registro) que el usuario aceptó.
    let accepted = -1;
    for (const a of acceptances) {
      if (a.policyKey !== key) continue;
      const idx = policy.versions.findIndex((v) => v.version === a.version);
      if (idx > accepted) accepted = idx;
    }
    if (accepted >= required) continue;

    const v = policy.versions[cur];
    out.push({
      key,
      slug: policy.slug,
      title: policy.title,
      version: v.version,
      effectiveAt: v.effectiveAt,
      sha256: v.sha256,
      previouslyAccepted:
        accepted >= 0 ? policy.versions[accepted].version : null,
      changes:
        accepted >= 0
          ? policy.versions
              .slice(accepted + 1, cur + 1)
              .filter((x) => x.changeSummary && x.changeSummary.length > 0)
              .map((x) => ({
                version: x.version,
                summary: [...(x.changeSummary ?? [])],
              }))
          : [],
    });
  }
  return out;
}

/** Lo que manda el cliente al aceptar: qué versión de cada política vio y tildó. */
export interface SubmittedAcceptance {
  key: string;
  version: string;
}

export type AcceptanceCheck =
  | { ok: true; accepted: PendingPolicy[] }
  | { ok: false; status: 400 | 409; message: string };

/**
 * Valida lo que mandó el cliente contra lo que de verdad está pendiente. **El servidor nunca
 * confía en la lista del cliente** — solo la usa para saber que el usuario vio y tildó cada
 * política:
 *
 * - falta alguna pendiente → 400;
 * - el cliente aceptó una versión que ya no es la vigente (la política cambió mientras tenía
 *   el formulario abierto) → 409, para que recargue y lea la nueva;
 * - entradas de políticas que no estaban pendientes se ignoran (no se guarda nada por ellas).
 *
 * Si sale bien, `accepted` son las pendientes a registrar (con su versión y hash del servidor).
 */
export function checkSubmittedAcceptances(
  pending: readonly PendingPolicy[],
  submitted: readonly SubmittedAcceptance[],
): AcceptanceCheck {
  for (const p of pending) {
    const sent = submitted.find((s) => s.key === p.key);
    if (!sent) {
      return {
        ok: false,
        status: 400,
        message: `Tenés que aceptar la ${p.title.toLowerCase()} para continuar`,
      };
    }
    if (sent.version !== p.version) {
      return {
        ok: false,
        status: 409,
        message: `La ${p.title.toLowerCase()} se actualizó mientras la leías. Revisá la versión nueva y volvé a aceptar.`,
      };
    }
  }
  return { ok: true, accepted: [...pending] };
}
