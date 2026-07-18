import { describe, expect, it } from "vitest";
import { appConfig, getBrand, getContact, getThemeStorageKey } from "./index";

describe("app config", () => {
  it("resolves brand identity and theme colors", () => {
    const brand = getBrand();
    expect(brand.name).toBeTruthy();
    expect(brand.theme.primary).toMatch(/^#/);
    expect(brand.theme.secondary).toMatch(/^#/);
    expect(typeof brand.logo).toBe("function");
  });

  it("exposes contact details", () => {
    expect(getContact().email).toContain("@");
  });

  it("provides a stable theme storage key", () => {
    expect(getThemeStorageKey()).toBeTruthy();
  });

  it("registers the events module as enabled by default", () => {
    expect(appConfig.modules.events.enabled).toBe(true);
    expect(appConfig.modules.news?.enabled).toBe(false);
  });
});
