import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Los senders de correo NO pueden ser Server Actions. Un archivo `"use server"` expone cada
 * función async exportada como un endpoint POST público: cualquiera podía invocar
 * `sendResetEmail(correo, token)` desde el navegador y mandar correos con el SMTP de La Nube
 * a cualquier dirección. Son módulos `server-only`: solo los importa código de servidor.
 */
describe("src/lib/email", () => {
  const dir = __dirname;
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => [f, readFileSync(path.join(dir, f), "utf8")] as const);

  it.each(sources)("%s no es un Server Action", (_file, source) => {
    expect(source).not.toMatch(/^\s*["']use server["']/m);
  });
});
