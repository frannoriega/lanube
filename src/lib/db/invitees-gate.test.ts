import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { isInvitedToRegister } from "./participants";

function tx(found: boolean) {
  const findUnique = vi.fn().mockResolvedValue(found ? { id: "i1" } : null);
  return { tx: { eventInvitee: { findUnique } } as never, findUnique };
}

describe("isInvitedToRegister (milestone 43)", () => {
  const base = { eventId: "e1", email: "a@x.com" };

  it("un evento público nunca restringe (aunque tenga lista)", async () => {
    const { tx: t, findUnique } = tx(false);
    expect(
      await isInvitedToRegister(t, {
        ...base,
        isPrivate: false,
        inviteeCount: 3,
      }),
    ).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("privado sin lista: cualquiera con el enlace", async () => {
    const { tx: t } = tx(false);
    expect(
      await isInvitedToRegister(t, {
        ...base,
        isPrivate: true,
        inviteeCount: 0,
      }),
    ).toBe(true);
  });

  it("privado con lista: solo los de la lista", async () => {
    expect(
      await isInvitedToRegister(tx(true).tx, {
        ...base,
        isPrivate: true,
        inviteeCount: 2,
      }),
    ).toBe(true);
    expect(
      await isInvitedToRegister(tx(false).tx, {
        ...base,
        isPrivate: true,
        inviteeCount: 2,
      }),
    ).toBe(false);
  });
});
