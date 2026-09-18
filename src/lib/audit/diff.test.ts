import { describe, expect, it } from "vitest";
import { actorLabelFor, diffFields } from "./diff";

describe("diffFields", () => {
  it("returns null when none of the given keys changed", () => {
    const before = { status: "PENDING", reason: "x" };
    const after = { status: "PENDING", reason: "y" };
    expect(diffFields(before, after, ["status"])).toBeNull();
  });

  it("includes only the keys that actually changed", () => {
    const before: { status: string; deniedReason: string | null } = {
      status: "PENDING",
      deniedReason: null,
    };
    const after = { status: "REJECTED", deniedReason: "no capacity" };
    expect(diffFields(before, after, ["status", "deniedReason"])).toEqual({
      before: { status: "PENDING", deniedReason: null },
      after: { status: "REJECTED", deniedReason: "no capacity" },
    });
  });

  it("ignores keys outside the given list even if they changed", () => {
    const before = { status: "PENDING", untouched: 1 };
    const after = { status: "PENDING", untouched: 2 };
    expect(diffFields(before, after, ["status"])).toBeNull();
  });
});

describe("actorLabelFor", () => {
  it("prefers the display email when present", () => {
    expect(
      actorLabelFor({
        name: "Ana",
        lastName: "Pérez",
        user: { email: "ana@lanube.local", displayEmail: "Ana.P@gmail.com" },
      }),
    ).toBe("Ana Pérez <Ana.P@gmail.com>");
  });

  it("falls back to the canonical email with no display email", () => {
    expect(
      actorLabelFor({
        name: "Ana",
        lastName: "Pérez",
        user: { email: "ana@lanube.local", displayEmail: null },
      }),
    ).toBe("Ana Pérez <ana@lanube.local>");
  });

  it("falls back to just the email when name/lastName are blank", () => {
    expect(
      actorLabelFor({
        name: "",
        lastName: "",
        user: { email: "ana@lanube.local", displayEmail: null },
      }),
    ).toBe("ana@lanube.local");
  });
});
