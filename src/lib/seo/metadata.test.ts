import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  absoluteUrl,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  jsonLdScript,
  organizationJsonLd,
  pageMetadata,
  siteUrl,
  toMetaDescription,
} from "./metadata";

const ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXTAUTH_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("siteUrl / absoluteUrl (milestone 41)", () => {
  it("prefiere NEXT_PUBLIC_SITE_URL y saca la barra final", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://lanube.example/";
    process.env.NEXTAUTH_URL = "https://otro.example";
    expect(siteUrl()).toBe("https://lanube.example");
  });

  it("cae en NEXTAUTH_URL y después en localhost", () => {
    process.env.NEXTAUTH_URL = "https://auth.example";
    expect(siteUrl()).toBe("https://auth.example");
    delete process.env.NEXTAUTH_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("absoluteUrl respeta las URLs absolutas (Vercel Blob)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://lanube.example";
    expect(absoluteUrl("/uploads/a.jpg")).toBe(
      "https://lanube.example/uploads/a.jpg",
    );
    expect(absoluteUrl("https://blob.example/a.jpg")).toBe(
      "https://blob.example/a.jpg",
    );
  });
});

describe("toMetaDescription", () => {
  it("saca markdown y saltos de línea", () => {
    expect(toMetaDescription("# Título\n\n**Negrita** y _algo_")).toBe(
      "Título Negrita y algo",
    );
  });

  it("corta en un espacio con elipsis", () => {
    const d = toMetaDescription("palabra ".repeat(40), 50)!;
    expect(d.length).toBeLessThanOrEqual(50);
    expect(d.endsWith("…")).toBe(true);
    expect(d).not.toMatch(/ …$/);
  });

  it("vacío → undefined", () => {
    expect(toMetaDescription("  ")).toBeUndefined();
    expect(toMetaDescription(null)).toBeUndefined();
  });
});

describe("pageMetadata", () => {
  it("usa la imagen propia de la página", () => {
    const m = pageMetadata({
      title: "Hackatón",
      description: "Desc",
      path: "/events/abc",
      image: "/uploads/hack.jpg",
    });
    expect(m.openGraph?.images).toEqual([
      { url: "/uploads/hack.jpg", alt: "Hackatón" },
    ]);
    expect(m.alternates?.canonical).toBe("/events/abc");
    expect(m.openGraph).toMatchObject({ siteName: "La Nube", locale: "es_AR" });
  });

  it("sin imagen cae en la de marca (nunca el escudo municipal) y la descripción del sitio", () => {
    const m = pageMetadata({ path: "/" });
    expect(m.openGraph?.images).toEqual([DEFAULT_OG_IMAGE]);
    expect(m.description).toBe(DEFAULT_DESCRIPTION);
    expect(m.robots).toBeUndefined();
  });

  it("noindex para lo que se comparte pero no se indexa", () => {
    const m = pageMetadata({ path: "/forms/x", noindex: true });
    expect(m.robots).toEqual({ index: false, follow: false });
  });

  it("la descripción por defecto entra en 160 caracteres", () => {
    expect(DEFAULT_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });
});

describe("organizationJsonLd / jsonLdScript", () => {
  const contact = {
    addressText: "Calle 1 </script><script>alert(1)</script>",
    email: "hola@lanube.example",
    phoneClickable: "+5493440000000",
    instagramUrl: "https://instagram.com/lanube",
    githubUrl: "",
  };

  it("arma la organización con los enlaces que existen", () => {
    const ld = organizationJsonLd(contact);
    expect(ld["@type"]).toBe("Organization");
    expect(ld.sameAs).toEqual(["https://instagram.com/lanube"]);
  });

  it("no deja cerrar la etiqueta <script>", () => {
    const out = jsonLdScript(organizationJsonLd(contact));
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).address.streetAddress).toContain("</script>");
  });
});
