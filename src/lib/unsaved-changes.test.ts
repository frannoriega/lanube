import { describe, expect, it } from "vitest";
import { type LinkClick, shouldInterceptLink } from "./unsaved-changes";

const here = "http://localhost:3000/admin/events/abc";
const click = (over: Partial<LinkClick>): LinkClick => ({
  href: "http://localhost:3000/admin/events",
  target: null,
  hasDownload: false,
  button: 0,
  modified: false,
  defaultPrevented: false,
  ...over,
});

describe("shouldInterceptLink", () => {
  it("intercepta un link interno a otra página", () => {
    expect(shouldInterceptLink(click({}), here)).toBe(true);
  });

  it("no intercepta anclas de la misma página (índice de secciones)", () => {
    expect(shouldInterceptLink(click({ href: `${here}#agenda` }), here)).toBe(
      false,
    );
  });

  it("no intercepta otra pestaña, modificadores, descargas ni otros orígenes", () => {
    expect(shouldInterceptLink(click({ target: "_blank" }), here)).toBe(false);
    expect(shouldInterceptLink(click({ modified: true }), here)).toBe(false);
    expect(shouldInterceptLink(click({ button: 1 }), here)).toBe(false);
    expect(shouldInterceptLink(click({ hasDownload: true }), here)).toBe(false);
    expect(
      shouldInterceptLink(click({ href: "https://example.com/x" }), here),
    ).toBe(false);
  });

  it("no intercepta clicks ya cancelados ni elementos que no son links", () => {
    expect(shouldInterceptLink(click({ defaultPrevented: true }), here)).toBe(
      false,
    );
    expect(shouldInterceptLink(click({ href: null }), here)).toBe(false);
  });
});
