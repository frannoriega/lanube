import { describe, expect, it } from "vitest";
import {
  MSG_DISALLOWED_PLUS_TAG,
  normalizeEmailForIdentity,
  parseEmailIdentityForNormalization,
  tryNormalizeEmailForIdentity,
} from "./identity";

describe("parseEmailIdentityForNormalization", () => {
  it("lowercases and trims", () => {
    expect(parseEmailIdentityForNormalization("  User@Example.COM  ")).toEqual({
      localBase: "user",
      domain: "example.com",
    });
  });

  it("uses last @ for local part", () => {
    expect(
      parseEmailIdentityForNormalization("a@b@c.com"),
    ).toEqual({
      localBase: "a@b",
      domain: "c.com",
    });
  });

  it("strips sole +lanube tag", () => {
    expect(
      parseEmailIdentityForNormalization("john+lanube@gmail.com"),
    ).toEqual({
      localBase: "john",
      domain: "gmail.com",
    });
  });

  it("rejects other +tags", () => {
    expect(() =>
      parseEmailIdentityForNormalization("john+work@gmail.com"),
    ).toThrow(MSG_DISALLOWED_PLUS_TAG);
  });

  it("rejects multiple plus signs", () => {
    expect(() =>
      parseEmailIdentityForNormalization("john+a+b@gmail.com"),
    ).toThrow(MSG_DISALLOWED_PLUS_TAG);
  });

  it("rejects bare +lanube", () => {
    expect(() =>
      parseEmailIdentityForNormalization("+lanube@gmail.com"),
    ).toThrow();
  });
});

describe("normalizeEmailForIdentity (sync, Gmail dots only)", () => {
  it("strips dots for gmail.com", () => {
    expect(normalizeEmailForIdentity("J.Hn.Doe@gmail.com")).toBe(
      "jhndoe@gmail.com",
    );
  });

  it("strips dots for googlemail.com", () => {
    expect(normalizeEmailForIdentity("a.b@googlemail.com")).toBe(
      "ab@googlemail.com",
    );
  });

  it("preserves dots for non-Gmail domains", () => {
    expect(normalizeEmailForIdentity("john.doe@yahoo.com")).toBe(
      "john.doe@yahoo.com",
    );
  });

  it("normalizes +lanube then gmail dots", () => {
    expect(normalizeEmailForIdentity("j.o.h.n+lanube@gmail.com")).toBe(
      "john@gmail.com",
    );
  });
});

describe("tryNormalizeEmailForIdentity", () => {
  it("returns err for invalid +tag", () => {
    const r = tryNormalizeEmailForIdentity("x+y@yahoo.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(MSG_DISALLOWED_PLUS_TAG);
  });
});
