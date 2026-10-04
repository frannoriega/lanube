import { describe, expect, it } from "vitest";
import { POLICY_GATE_DEFAULT_NEXT, policyGateUrl, safeGateNext } from "./gate";

describe("safeGateNext", () => {
  it.each([
    "/user/dashboard",
    "/user/spaces/coworking?week=2",
    "/admin/events/abc/participants",
    "/admin",
    "/auth/signup",
  ])("acepta la ruta interna gateada %s", (path) => {
    expect(safeGateNext(path)).toBe(path);
  });

  it.each([
    null,
    "",
    "//evil.com/user",
    "https://evil.com/user",
    "/\\evil.com",
    "user/dashboard",
    "/news",
    "/policies/accept",
    "/userx",
    "/admin\u0000",
  ])("rechaza %s y vuelve al default", (raw) => {
    expect(safeGateNext(raw)).toBe(POLICY_GATE_DEFAULT_NEXT);
  });
});

describe("policyGateUrl", () => {
  it("omite next cuando es el default", () => {
    expect(policyGateUrl(null)).toBe("/policies/accept");
  });

  it("codifica el next", () => {
    expect(policyGateUrl("/user/spaces/lab?d=1")).toBe(
      "/policies/accept?next=%2Fuser%2Fspaces%2Flab%3Fd%3D1",
    );
  });
});
