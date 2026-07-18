import { describe, expect, it } from "vitest";
import { getModuleNav, isModuleEnabled } from "./manifests";
import { getModule, getModuleConfig, getModules } from "./registry";

/**
 * These assertions reflect the default app.config.ts (events enabled, news disabled).
 * They prove the core pluggability contract: enabled modules surface their api/nav,
 * disabled ones are fully absent.
 */
describe("module registry", () => {
  it("exposes enabled modules and hides disabled ones", () => {
    expect(isModuleEnabled("events")).toBe(true);
    expect(isModuleEnabled("news")).toBe(false);
    expect(getModule("events")).toBeDefined();
    expect(getModule("news")).toBeUndefined();
    expect(getModules().map((m) => m.id)).toContain("events");
    expect(getModules().map((m) => m.id)).not.toContain("news");
  });

  it("validates and defaults module config through the module's schema", () => {
    const cfg = getModuleConfig<{
      showOnLanding: boolean;
      landingLimit: number;
    }>("events");
    expect(cfg).toEqual({ showOnLanding: true, landingLimit: 8 });
    // Disabled module resolves to undefined.
    expect(getModuleConfig("news")).toBeUndefined();
  });

  it("aggregates nav from enabled modules only", () => {
    const adminHrefs = getModuleNav("admin").map((e) => e.href);
    expect(adminHrefs).toContain("/admin/events");
    expect(adminHrefs).toContain("/admin/forms");
    // news is disabled -> its /admin/news entry must not appear
    expect(adminHrefs).not.toContain("/admin/news");

    const userHrefs = getModuleNav("user").map((e) => e.href);
    expect(userHrefs).toContain("/user/events");
  });
});
