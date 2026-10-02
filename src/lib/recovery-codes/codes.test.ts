import { describe, expect, it } from "vitest";
import {
  formatRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_ALPHABET,
} from "./codes";

describe("códigos de recuperación", () => {
  it("el alfabeto tiene 32 símbolos sin ambigüedades", () => {
    expect(new Set(RECOVERY_CODE_ALPHABET).size).toBe(32);
    for (const ch of "ILOU") expect(RECOVERY_CODE_ALPHABET).not.toContain(ch);
  });

  it("formatea en grupos de cuatro", () => {
    expect(formatRecoveryCode("ABCD1234EFGH")).toBe("ABCD-1234-EFGH");
  });

  it("normaliza minúsculas, espacios, guiones y letras confundibles", () => {
    expect(normalizeRecoveryCode("abcd-1234-efgh")).toBe("ABCD1234EFGH");
    expect(normalizeRecoveryCode(" ABCD 1234 EFGH ")).toBe("ABCD1234EFGH");
    expect(normalizeRecoveryCode("0OIL-0000-0000")).toBe("0011" + "00000000");
  });

  it("rechaza largos incorrectos o símbolos fuera del alfabeto", () => {
    expect(normalizeRecoveryCode("ABCD-1234")).toBeNull();
    expect(normalizeRecoveryCode("ABCD-1234-EFGU")).toBeNull();
    expect(normalizeRecoveryCode("ABCD-1234-EFG!")).toBeNull();
  });
});
