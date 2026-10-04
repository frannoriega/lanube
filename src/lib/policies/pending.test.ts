import { describe, expect, it } from "vitest";
import { startOfDateKeyMs } from "@/lib/admin/admin-timezone";
import {
  checkSubmittedAcceptances,
  currentVersion,
  pendingPolicies,
  type AcceptanceRecord,
} from "./pending";
import type { PolicyDefinition, PolicyVersion } from "./registry";

/** Una versión de prueba: exige aceptación y re-aceptación salvo que se diga otra cosa. */
function v(version: string, over: Partial<PolicyVersion> = {}): PolicyVersion {
  return {
    version,
    effectiveAt: version,
    file: `x/${version}.mdx`,
    sha256: `hash-${version}`,
    requiresAcceptance: true,
    reacceptance: "required",
    changeSummary: [`cambios de ${version}`],
    ...over,
  };
}

function registry(
  ...versions: PolicyVersion[]
): Record<string, PolicyDefinition> {
  return {
    privacy: {
      slug: "privacy",
      title: "Política de privacidad",
      description: "",
      versions,
    },
  };
}

const at = (date: string) => startOfDateKeyMs(date);
const acc = (version: string): AcceptanceRecord => ({
  policyKey: "privacy",
  version,
});

describe("currentVersion", () => {
  it("rige desde las 00:00 del día en la zona del predio, no antes", () => {
    const reg = registry(v("2026-01-01"), v("2026-03-01"));
    // 2026-03-01 00:00 en Argentina (UTC−3) es 03:00 UTC: un minuto antes sigue la anterior.
    expect(
      currentVersion(reg.privacy, at("2026-03-01") - 60_000)?.version,
    ).toBe("2026-01-01");
    expect(currentVersion(reg.privacy, at("2026-03-01"))?.version).toBe(
      "2026-03-01",
    );
  });

  it("devuelve null si todavía no rige ninguna", () => {
    const reg = registry(v("2026-01-01"));
    expect(currentVersion(reg.privacy, at("2025-12-31"))).toBeNull();
  });
});

describe("pendingPolicies", () => {
  it("un usuario nuevo tiene pendiente la versión vigente, sin cambios que mostrar", () => {
    const reg = registry(v("2026-01-01"), v("2026-02-01"));
    const [p] = pendingPolicies(reg, [], at("2026-02-10"));
    expect(p.version).toBe("2026-02-01");
    expect(p.previouslyAccepted).toBeNull();
    expect(p.changes).toEqual([]);
  });

  it("quien aceptó la vigente no tiene nada pendiente", () => {
    const reg = registry(v("2026-01-01"));
    expect(pendingPolicies(reg, [acc("2026-01-01")], at("2026-01-05"))).toEqual(
      [],
    );
  });

  it("un cambio editorial no vuelve a pedir aceptación a quien aceptó la anterior", () => {
    const reg = registry(
      v("2026-01-01"),
      v("2026-02-01", { reacceptance: "not-required" }),
    );
    expect(pendingPolicies(reg, [acc("2026-01-01")], at("2026-02-10"))).toEqual(
      [],
    );
  });

  it("pero un usuario nuevo acepta la versión editorial (la vigente), no la vieja", () => {
    const reg = registry(
      v("2026-01-01"),
      v("2026-02-01", { reacceptance: "not-required" }),
    );
    expect(pendingPolicies(reg, [], at("2026-02-10"))[0].version).toBe(
      "2026-02-01",
    );
  });

  it("un cambio sustancial pide aceptar de nuevo, con los resúmenes desde lo aceptado", () => {
    const reg = registry(
      v("2026-01-01"),
      v("2026-02-01"),
      v("2026-03-01", { reacceptance: "not-required" }),
    );
    const [p] = pendingPolicies(reg, [acc("2026-01-01")], at("2026-03-10"));
    expect(p.version).toBe("2026-03-01"); // se acepta la vigente, no la que disparó
    expect(p.previouslyAccepted).toBe("2026-01-01");
    expect(p.changes.map((c) => c.version)).toEqual([
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  it("una versión desplegada con vigencia futura no frena a nadie hasta su fecha", () => {
    const reg = registry(v("2026-01-01"), v("2026-06-01"));
    const accepted = [acc("2026-01-01")];
    expect(pendingPolicies(reg, accepted, at("2026-05-31"))).toEqual([]);
    expect(pendingPolicies(reg, accepted, at("2026-06-01"))).toHaveLength(1);
  });

  it("una política informativa que pasa a ser obligatoria se pide aunque sea 'not-required'", () => {
    const reg = registry(
      v("2026-01-01", { requiresAcceptance: false }),
      v("2026-02-01", { reacceptance: "not-required" }),
    );
    expect(pendingPolicies(reg, [], at("2026-01-10"))).toEqual([]);
    expect(pendingPolicies(reg, [], at("2026-02-10"))).toHaveLength(1);
  });

  it("si la vigente es informativa no se pide nada, aunque antes se exigiera", () => {
    const reg = registry(
      v("2026-01-01"),
      v("2026-02-01", { requiresAcceptance: false }),
    );
    expect(pendingPolicies(reg, [], at("2026-02-10"))).toEqual([]);
  });

  it("haber aceptado una versión posterior a la exigida también cuenta", () => {
    const reg = registry(
      v("2026-01-01"),
      v("2026-02-01", { reacceptance: "not-required" }),
    );
    expect(pendingPolicies(reg, [acc("2026-02-01")], at("2026-02-10"))).toEqual(
      [],
    );
  });

  it("ignora aceptaciones de otras políticas y de versiones desconocidas", () => {
    const reg = registry(v("2026-01-01"));
    const others: AcceptanceRecord[] = [
      { policyKey: "terms", version: "2026-01-01" },
      acc("1999-01-01"),
    ];
    expect(pendingPolicies(reg, others, at("2026-01-05"))).toHaveLength(1);
  });
});

describe("checkSubmittedAcceptances", () => {
  const reg = registry(v("2026-01-01"));
  const pending = pendingPolicies(reg, [], at("2026-01-05"));

  it("acepta cuando el cliente tildó la versión vigente", () => {
    const r = checkSubmittedAcceptances(pending, [
      { key: "privacy", version: "2026-01-01" },
    ]);
    expect(r.ok).toBe(true);
  });

  it("400 si falta una pendiente", () => {
    const r = checkSubmittedAcceptances(pending, []);
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it("409 si el cliente aceptó una versión que ya no es la vigente", () => {
    const r = checkSubmittedAcceptances(pending, [
      { key: "privacy", version: "2025-01-01" },
    ]);
    expect(r).toMatchObject({ ok: false, status: 409 });
  });

  it("sin pendientes, cualquier envío es válido y no registra nada", () => {
    const r = checkSubmittedAcceptances([], [{ key: "privacy", version: "x" }]);
    expect(r).toEqual({ ok: true, accepted: [] });
  });
});
