import { afterEach, describe, expect, it, vi } from "vitest";

import { participantUploadsPrefix, storageEnvRoot } from "@/lib/storage/types";

describe("storageEnvRoot", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sin variables cae en dev", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("STORAGE_ENV_ROOT", "");
    expect(storageEnvRoot()).toBe("dev");
  });

  it("deriva el entorno de VERCEL_ENV", () => {
    vi.stubEnv("STORAGE_ENV_ROOT", "");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(storageEnvRoot()).toBe("prod");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(storageEnvRoot()).toBe("preview");
  });

  it("STORAGE_ENV_ROOT gana sobre VERCEL_ENV (VPS: no hay VERCEL_ENV)", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("STORAGE_ENV_ROOT", "prod");
    expect(storageEnvRoot()).toBe("prod");
    expect(participantUploadsPrefix()).toBe("prod/events/participant-uploads/");
  });

  it("ignora un valor que no es un segmento seguro", () => {
    vi.stubEnv("VERCEL_ENV", "");
    for (const bad of ["../prod", "a/b", "prod/", "a b"]) {
      vi.stubEnv("STORAGE_ENV_ROOT", bad);
      expect(storageEnvRoot()).toBe("dev");
    }
  });
});
