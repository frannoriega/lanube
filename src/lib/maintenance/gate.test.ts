import { describe, expect, it, vi } from "vitest";
import {
  FAIL_TTL_MS,
  OK_TTL_MS,
  createSnapshotLoader,
  maintenanceBlock,
  needsMaintenanceCheck,
} from "./gate";
import type { MaintenanceSnapshot, StatefulWindow } from "./evaluate";

const readOnly: StatefulWindow = {
  id: "w",
  title: "Migración",
  reasonMd: "Motivo",
  mode: "READ_ONLY",
  areas: ["all"],
  startsAt: null,
  endsAt: null,
  endedAt: null,
  state: "active",
};
const snap = (windows: StatefulWindow[]): MaintenanceSnapshot => ({
  now: 0,
  windows,
});

describe("needsMaintenanceCheck", () => {
  it("las lecturas comunes no cuestan nada; las escrituras siempre se miran", () => {
    expect(needsMaintenanceCheck("GET", "/api/admin/users")).toBe(false);
    expect(needsMaintenanceCheck("GET", "/api/user/stats")).toBe(false);
    expect(needsMaintenanceCheck("POST", "/api/admin/events")).toBe(true);
    expect(needsMaintenanceCheck("DELETE", "/api/anything")).toBe(true);
  });
  it("una lectura bajo el prefijo de un área sí se mira (UNAVAILABLE frena también los GET)", () => {
    expect(needsMaintenanceCheck("GET", "/api/auth/reset")).toBe(true);
    expect(needsMaintenanceCheck("GET", "/api/forms/mi-evento")).toBe(true);
  });
  it("nunca consulta el propio endpoint de estado", () => {
    expect(needsMaintenanceCheck("GET", "/api/maintenance")).toBe(false);
    expect(needsMaintenanceCheck("POST", "/api/maintenance")).toBe(false);
  });
});

describe("maintenanceBlock", () => {
  it("responde con el mensaje y el código, o null si pasa", () => {
    expect(
      maintenanceBlock(snap([readOnly]), "POST", "/api/user/profile"),
    ).toEqual(expect.objectContaining({ code: "MAINTENANCE" }));
    expect(
      maintenanceBlock(snap([readOnly]), "GET", "/api/user/profile"),
    ).toBeNull();
    expect(maintenanceBlock(snap([]), "POST", "/api/user/profile")).toBeNull();
  });
});

describe("createSnapshotLoader", () => {
  it("recuerda el resultado hasta que vence y después vuelve a consultar", async () => {
    let t = 0;
    const fetchSnapshot = vi.fn().mockResolvedValue(snap([readOnly]));
    const load = createSnapshotLoader(fetchSnapshot, () => t);
    await load();
    await load();
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    t = OK_TTL_MS + 1;
    await load();
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
  });
  it("comparte una sola consulta entre pedidos simultáneos", async () => {
    const fetchSnapshot = vi.fn().mockResolvedValue(snap([]));
    const load = createSnapshotLoader(fetchSnapshot, () => 0);
    await Promise.all([load(), load(), load()]);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });
  it("falla abierto: si no pudo leer, no hay mantenimiento — y reintenta pronto", async () => {
    let t = 0;
    const fetchSnapshot = vi
      .fn()
      .mockRejectedValueOnce(new Error("caído"))
      .mockResolvedValue(snap([readOnly]));
    const load = createSnapshotLoader(fetchSnapshot, () => t);
    expect((await load()).windows).toEqual([]);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    t = FAIL_TTL_MS + 1;
    expect((await load()).windows).toHaveLength(1);
  });
});
