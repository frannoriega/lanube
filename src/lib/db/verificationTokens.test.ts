import { describe, expect, it, vi } from "vitest";

// El módulo importa prisma/SMTP; la regla a probar es pura.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/email/confirmation", () => ({ sendEmailConfirmation: vi.fn() }));
vi.mock("@/lib/oauth/server", () => ({ revokeAllGrantsForUser: vi.fn() }));

import { needsNewConfirmationLink } from "./verificationTokens";

describe("needsNewConfirmationLink", () => {
  const at = 1_000_000;
  it("reenvía si no hay ningún token", () => {
    expect(needsNewConfirmationLink([], at)).toBe(true);
  });
  it("reenvía si todos vencieron", () => {
    expect(needsNewConfirmationLink([{ expires: BigInt(at - 1) }], at)).toBe(
      true,
    );
  });
  it("NO reenvía mientras haya uno vigente (anti-spam)", () => {
    expect(
      needsNewConfirmationLink(
        [{ expires: at - 5 }, { expires: BigInt(at + 5) }],
        at,
      ),
    ).toBe(false);
  });
});
