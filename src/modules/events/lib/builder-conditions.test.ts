import {
  buildVisibleWhen,
  parseVisibleWhen,
} from "@/modules/events/lib/builder-conditions";
import type { Condition } from "@/modules/events/lib/form-schema";
import { describe, expect, it } from "vitest";

describe("buildVisibleWhen", () => {
  it("returns null with no field (always visible)", () => {
    expect(buildVisibleWhen({ field: "", op: "eq", value: "x" })).toBeNull();
  });

  it("builds eq/neq with a string value", () => {
    expect(
      buildVisibleWhen({ field: "role", op: "eq", value: "Docente" }),
    ).toEqual({
      op: "eq",
      field: "role",
      value: "Docente",
    });
  });

  it("builds numeric gt/lt with a parsed number", () => {
    expect(buildVisibleWhen({ field: "age", op: "gt", value: "18" })).toEqual({
      op: "gt",
      field: "age",
      value: 18,
    });
  });

  it("builds answered/empty without a value", () => {
    expect(
      buildVisibleWhen({ field: "role", op: "answered", value: "" }),
    ).toEqual({
      op: "answered",
      field: "role",
    });
  });

  it("returns null when a value is required but missing/invalid", () => {
    expect(buildVisibleWhen({ field: "role", op: "eq", value: "" })).toBeNull();
    expect(
      buildVisibleWhen({ field: "age", op: "gt", value: "abc" }),
    ).toBeNull();
  });
});

describe("parseVisibleWhen", () => {
  it("round-trips a simple predicate", () => {
    const cond: Condition = { op: "eq", field: "role", value: "Docente" };
    expect(parseVisibleWhen(cond)).toEqual({
      field: "role",
      op: "eq",
      value: "Docente",
    });
  });

  it("stringifies numeric values", () => {
    const cond: Condition = { op: "gt", field: "age", value: 18 };
    expect(parseVisibleWhen(cond)).toEqual({
      field: "age",
      op: "gt",
      value: "18",
    });
  });

  it("treats null and compound conditions as always-visible", () => {
    expect(parseVisibleWhen(null)).toEqual({ field: "", op: "eq", value: "" });
    expect(
      parseVisibleWhen({
        op: "and",
        conditions: [{ op: "eq", field: "a", value: "b" }],
      }),
    ).toEqual({ field: "", op: "eq", value: "" });
  });

  it("build → parse round-trip is stable", () => {
    const state = { field: "role", op: "neq", value: "x" };
    expect(parseVisibleWhen(buildVisibleWhen(state))).toEqual(state);
  });
});
