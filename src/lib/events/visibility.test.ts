import { describe, expect, it } from "vitest";
import { eventInputSchema } from "@/lib/schemas/events";
import { isEventPubliclyListed, PUBLIC_EVENT_WHERE } from "./visibility";

describe("visibilidad pública de un evento (milestone 43)", () => {
  const base = { status: "PUBLISHED", deletedAt: null, isPrivate: false };

  it("publicado, no cancelado y no privado → se lista", () => {
    expect(isEventPubliclyListed(base)).toBe(true);
  });

  it("privado, borrador o cancelado → no se lista", () => {
    expect(isEventPubliclyListed({ ...base, isPrivate: true })).toBe(false);
    expect(isEventPubliclyListed({ ...base, status: "DRAFT" })).toBe(false);
    expect(isEventPubliclyListed({ ...base, deletedAt: BigInt(1) })).toBe(
      false,
    );
  });

  it("el filtro de Prisma dice lo mismo", () => {
    expect(PUBLIC_EVENT_WHERE).toEqual(base);
  });
});

describe("eventInputSchema: privado y destacado (milestone 43)", () => {
  const valid = {
    name: "Taller",
    description: "x".repeat(120),
    summary: "",
    isFeatured: false,
    isPrivate: false,
    eventType: "WORKSHOP",
    status: "PUBLISHED",
    spaceId: "s1",
    startDate: "2026-12-01",
    endDate: "2026-12-31",
    weekdays: [2],
    startTime: "10:00",
    endTime: "12:00",
    capacity: null,
    requiresApproval: false,
    checkInEnabled: false,
    imageUrl: "https://x.example/a.jpg",
    form: null,
  };

  it("un privado no se puede destacar", () => {
    const r = eventInputSchema.safeParse({
      ...valid,
      isPrivate: true,
      isFeatured: true,
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join("."))).toContain(
      "isFeatured",
    );
  });

  it("privado sin destacar, o sin el campo (clientes viejos), es válido", () => {
    expect(
      eventInputSchema.safeParse({ ...valid, isPrivate: true }).success,
    ).toBe(true);
    const old: Partial<typeof valid> = { ...valid };
    delete old.isPrivate;
    expect(eventInputSchema.safeParse(old).success).toBe(true);
  });
});
