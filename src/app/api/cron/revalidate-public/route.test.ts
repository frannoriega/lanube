import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePublic = vi.fn();
vi.mock("@/lib/cache/public-reads", () => ({
  PUBLIC_TAGS: { a: "public:a", b: "public:b" },
  revalidatePublic: (...tags: string[]) => revalidatePublic(...tags),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from "@/app/api/cron/revalidate-public/route";

function request(authorization?: string) {
  return new NextRequest("http://localhost/api/cron/revalidate-public", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/cron/revalidate-public", () => {
  beforeEach(() => {
    revalidatePublic.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("503 si CRON_SECRET no está configurado", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(request("Bearer "));
    expect(res.status).toBe(503);
    expect(revalidatePublic).not.toHaveBeenCalled();
  });

  it("401 sin el Bearer correcto, y no invalida nada", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer otro"))).status).toBe(401);
    expect(revalidatePublic).not.toHaveBeenCalled();
  });

  it("200 e invalida todos los tags públicos", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await GET(request("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      tags: ["public:a", "public:b"],
    });
    expect(revalidatePublic).toHaveBeenCalledWith("public:a", "public:b");
  });
});
