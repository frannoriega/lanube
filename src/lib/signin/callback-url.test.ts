import { describe, expect, it } from "vitest";
import {
  safeCallbackUrl,
  SIGNIN_DEFAULT_CALLBACK,
  signInUrl,
} from "./callback-url";

describe("safeCallbackUrl", () => {
  it("acepta rutas internas permitidas, con query", () => {
    expect(safeCallbackUrl("/user/settings/security")).toBe(
      "/user/settings/security",
    );
    expect(safeCallbackUrl("/admin/dashboard")).toBe("/admin/dashboard");
    expect(
      safeCallbackUrl("/oauth/authorize?client_id=x&state=y&redirect_uri=z"),
    ).toBe("/oauth/authorize?client_id=x&state=y&redirect_uri=z");
  });

  it("cae en el default ante cualquier cosa externa o rara", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/news",
      "/oauth/authorizex",
      "/user\u0000",
      "javascript:alert(1)",
    ]) {
      expect(safeCallbackUrl(bad)).toBe(SIGNIN_DEFAULT_CALLBACK);
    }
  });
});

describe("signInUrl", () => {
  it("omite el parámetro cuando es el default", () => {
    expect(signInUrl(null)).toBe("/auth/signin");
    expect(signInUrl("https://evil.com")).toBe("/auth/signin");
  });

  it("codifica el callback", () => {
    expect(signInUrl("/oauth/authorize?a=1&b=2")).toBe(
      "/auth/signin?callbackUrl=%2Foauth%2Fauthorize%3Fa%3D1%26b%3D2",
    );
  });
});
