import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hasScopes, OAUTH_SCOPES, parseScopes } from "./config";
import {
  generateOpaqueToken,
  hashToken,
  isValidCodeVerifier,
  isValidS256Challenge,
  verifyPkceS256,
} from "./crypto";
import {
  isRegistrableRedirectUri,
  matchesRegisteredRedirectUri,
  redirectUriDisplayHost,
} from "./redirect-uri";
import { isOurResource, mcpResourceUrl } from "./origin";
import { isAcceptableCimdUrl, isPrivateAddress } from "./ssrf";

const challengeOf = (v: string) =>
  createHash("sha256").update(v).digest("base64url");

describe("PKCE", () => {
  const verifier = "a".repeat(20) + "-._~" + "Z9".repeat(10);

  it("acepta el verifier correcto", () => {
    expect(isValidCodeVerifier(verifier)).toBe(true);
    expect(verifyPkceS256(verifier, challengeOf(verifier))).toBe(true);
  });

  it("rechaza verifiers incorrectos, cortos o con caracteres inválidos", () => {
    expect(verifyPkceS256(verifier + "x", challengeOf(verifier))).toBe(false);
    expect(verifyPkceS256("corto", challengeOf("corto"))).toBe(false);
    expect(isValidCodeVerifier("a".repeat(42))).toBe(false);
    expect(isValidCodeVerifier("a".repeat(129))).toBe(false);
    expect(isValidCodeVerifier("a".repeat(43) + "!")).toBe(false);
  });

  it("valida la forma del challenge S256", () => {
    expect(isValidS256Challenge(challengeOf(verifier))).toBe(true);
    expect(isValidS256Challenge("plain-no-sirve")).toBe(false);
  });
});

describe("tokens opacos", () => {
  it("son únicos, base64url de 256 bits, y se guardan como sha256", () => {
    const a = generateOpaqueToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateOpaqueToken()).not.toBe(a);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
  });
});

describe("scopes", () => {
  it("vacío = todos, en orden canónico", () => {
    expect(parseScopes(null)).toEqual([...OAUTH_SCOPES]);
    expect(parseScopes("")).toEqual([...OAUTH_SCOPES]);
    expect(parseScopes("reservations:write reservations:read")).toEqual([
      "reservations:read",
      "reservations:write",
    ]);
  });

  it("rechaza scopes desconocidos en lugar de descartarlos", () => {
    expect(parseScopes("reservations:read admin")).toBeNull();
    expect(parseScopes("openid")).toBeNull();
  });

  it("hasScopes", () => {
    expect(hasScopes(["reservations:read"], ["reservations:read"])).toBe(true);
    expect(hasScopes(["reservations:read"], ["reservations:write"])).toBe(
      false,
    );
  });
});

describe("redirect_uri", () => {
  it("registrables: https, loopback http, esquemas privados", () => {
    expect(
      isRegistrableRedirectUri("https://claude.ai/api/mcp/auth_callback"),
    ).toBe(true);
    expect(isRegistrableRedirectUri("http://localhost:33418/callback")).toBe(
      true,
    );
    expect(isRegistrableRedirectUri("http://127.0.0.1/cb")).toBe(true);
    expect(isRegistrableRedirectUri("com.example.app:/oauth")).toBe(true);
  });

  it("no registrables: http a la red, fragmentos, esquemas peligrosos", () => {
    expect(isRegistrableRedirectUri("http://evil.com/cb")).toBe(false);
    expect(isRegistrableRedirectUri("https://claude.ai/cb#x")).toBe(false);
    expect(isRegistrableRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isRegistrableRedirectUri("data:text/html,hi")).toBe(false);
    expect(isRegistrableRedirectUri("noesunaurl")).toBe(false);
  });

  it("coincidencia exacta", () => {
    const reg = ["https://claude.ai/api/mcp/auth_callback"];
    expect(matchesRegisteredRedirectUri(reg, reg[0])).toBe(true);
    expect(matchesRegisteredRedirectUri(reg, reg[0] + "/")).toBe(false);
    expect(matchesRegisteredRedirectUri(reg, reg[0] + "?x=1")).toBe(false);
    expect(
      matchesRegisteredRedirectUri(
        reg,
        "https://claude.ai.evil.com/api/mcp/auth_callback",
      ),
    ).toBe(false);
  });

  it("loopback: el puerto no se compara (RFC 8252 §7.3), el resto sí", () => {
    const reg = ["http://localhost:1234/callback"];
    expect(
      matchesRegisteredRedirectUri(reg, "http://localhost:55555/callback"),
    ).toBe(true);
    expect(
      matchesRegisteredRedirectUri(reg, "http://localhost:55555/otra"),
    ).toBe(false);
    expect(
      matchesRegisteredRedirectUri(reg, "http://127.0.0.1:1234/callback"),
    ).toBe(false);
  });

  it("muestra el dominio", () => {
    expect(
      redirectUriDisplayHost("https://claude.ai/api/mcp/auth_callback"),
    ).toBe("claude.ai");
  });
});

describe("resource", () => {
  it("compara con la URL del endpoint MCP, tolerando barra final", () => {
    const origin = "https://lanube.example";
    expect(mcpResourceUrl(origin)).toBe("https://lanube.example/api/mcp");
    expect(isOurResource("https://lanube.example/api/mcp/", origin)).toBe(true);
    expect(isOurResource("https://otro.example/api/mcp", origin)).toBe(false);
  });
});

describe("SSRF (CIMD)", () => {
  it("detecta direcciones privadas", () => {
    for (const ip of [
      "10.0.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.5.4",
      "192.168.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
      "localhost",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("2606:4700::1111")).toBe(false);
  });

  it("acepta solo URLs https públicas con path", () => {
    expect(isAcceptableCimdUrl("https://claude.ai/oauth/client.json")).toBe(
      true,
    );
    expect(isAcceptableCimdUrl("http://claude.ai/oauth/client.json")).toBe(
      false,
    );
    expect(isAcceptableCimdUrl("https://claude.ai/")).toBe(false);
    expect(isAcceptableCimdUrl("https://user:pw@claude.ai/c.json")).toBe(false);
    expect(isAcceptableCimdUrl("https://claude.ai:8443/c.json")).toBe(false);
    expect(isAcceptableCimdUrl("https://10.0.0.1/c.json")).toBe(false);
    expect(isAcceptableCimdUrl("https://localhost/c.json")).toBe(false);
  });
});
