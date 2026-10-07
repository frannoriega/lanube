import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  editLinkExpired,
  editLinkPath,
  generateEditToken,
  hashEditToken,
} from "./edit-token";

describe("generateEditToken", () => {
  it("da 256 bits en base64url, distintos cada vez", () => {
    const a = generateEditToken();
    const b = generateEditToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});

describe("hashEditToken", () => {
  it("es el SHA-256 hex del token (lo mismo que hizo la migración en SQL)", () => {
    // Un cuid2 de los que había antes de la migración.
    const legacy = "mqgg9ld1teit6w1ml1et7nrk";
    expect(hashEditToken(legacy)).toBe(
      createHash("sha256").update(legacy).digest("hex"),
    );
    expect(hashEditToken(legacy)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("no guarda nada que permita volver al token", () => {
    const t = generateEditToken();
    expect(hashEditToken(t)).not.toContain(t);
  });
});

describe("editLinkExpired", () => {
  const now = 1_800_000_000_000;

  it("un evento de una vez vence al pasar su fin", () => {
    expect(
      editLinkExpired({ endTime: now + 1, recurrenceEnd: null }, now),
    ).toBe(false);
    expect(
      editLinkExpired({ endTime: now - 1, recurrenceEnd: null }, now),
    ).toBe(true);
  });

  it("uno recurrente vence al pasar el fin de la recurrencia, no el de la primera sesión", () => {
    expect(
      editLinkExpired(
        { endTime: BigInt(now - 86_400_000), recurrenceEnd: BigInt(now + 1) },
        now,
      ),
    ).toBe(false);
    expect(
      editLinkExpired({ endTime: now - 10, recurrenceEnd: now - 1 }, now),
    ).toBe(true);
  });
});

describe("editLinkPath", () => {
  it("arma el path público con el token escapado", () => {
    expect(editLinkPath("abc_-1")).toBe("/forms/response/abc_-1");
  });
});
