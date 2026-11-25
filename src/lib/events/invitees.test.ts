import { describe, expect, it } from "vitest";
import { inviteeState, parseInviteeList } from "./invitees";

describe("parseInviteeList (milestone 43)", () => {
  it("separa por coma, punto y coma, espacios y renglones", () => {
    expect(
      parseInviteeList("a@x.com, b@x.com;c@x.com\nd@x.com  e@x.com").valid,
    ).toEqual(["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"]);
  });

  it("toma el email de «Nombre <email>» y saca mailto:", () => {
    expect(
      parseInviteeList(
        'Ana Pérez <ana@x.com>, "Bo, Juan" <juan@y.org>; mailto:z@w.io',
      ).valid,
    ).toEqual(["ana@x.com", "juan@y.org", "z@w.io"]);
  });

  it("informa inválidos y repetidos (sin distinguir mayúsculas)", () => {
    const r = parseInviteeList("a@x.com, nope, A@X.com, b@, @c.com, b@x.com");
    expect(r.valid).toEqual(["a@x.com", "b@x.com"]);
    expect(r.repeated).toEqual(["A@X.com"]);
    expect(r.invalid).toEqual(["nope", "b@", "@c.com"]);
  });

  it("texto vacío → nada", () => {
    expect(parseInviteeList("  \n ")).toEqual({
      valid: [],
      invalid: [],
      repeated: [],
    });
  });
});

describe("inviteeState", () => {
  it("inscripto > invitado > sin enviar", () => {
    expect(inviteeState({ registered: true, invitedAt: null })).toBe(
      "registered",
    );
    expect(inviteeState({ registered: false, invitedAt: 1 })).toBe("invited");
    expect(inviteeState({ registered: false, invitedAt: null })).toBe(
      "pending",
    );
  });
});
