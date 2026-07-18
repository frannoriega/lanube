import { describe, expect, it } from "vitest";
import {
  PublicFormField,
  validateAnswer,
  validateAnswers,
} from "@/modules/events/lib/answers";

function field(overrides: Partial<PublicFormField>): PublicFormField {
  return {
    id: "f1",
    type: "SHORT_TEXT",
    label: "Campo",
    required: false,
    options: null,
    ...overrides,
  };
}

describe("validateAnswer", () => {
  it("requires non-empty values for required fields", () => {
    expect(validateAnswer(field({ required: true }), "")).toBeTruthy();
    expect(validateAnswer(field({ required: true }), "x")).toBeNull();
  });

  it("allows empty optional fields", () => {
    expect(validateAnswer(field({ required: false }), "")).toBeNull();
  });

  it("validates numbers", () => {
    expect(validateAnswer(field({ type: "FLOAT" }), "12")).toBeNull();
    expect(validateAnswer(field({ type: "FLOAT" }), "abc")).toBeTruthy();
  });

  it("validates DNI and phone", () => {
    expect(validateAnswer(field({ type: "DNI" }), "12345678")).toBeNull();
    expect(validateAnswer(field({ type: "DNI" }), "12")).toBeTruthy();
    expect(
      validateAnswer(field({ type: "PHONE" }), "+54 345 1234567"),
    ).toBeNull();
  });

  it("validates single and multi select against options", () => {
    const single = field({ type: "SINGLE_SELECT", options: ["a", "b"] });
    expect(validateAnswer(single, "a")).toBeNull();
    expect(validateAnswer(single, "z")).toBeTruthy();

    const multi = field({ type: "MULTI_SELECT", options: ["a", "b", "c"] });
    expect(validateAnswer(multi, ["a", "c"])).toBeNull();
    expect(validateAnswer(multi, ["a", "z"])).toBeTruthy();
  });

  it("validates date and time formats", () => {
    expect(validateAnswer(field({ type: "DATE" }), "2026-03-01")).toBeNull();
    expect(validateAnswer(field({ type: "DATE" }), "01/03/2026")).toBeTruthy();
    expect(validateAnswer(field({ type: "TIME" }), "10:30")).toBeNull();
    expect(validateAnswer(field({ type: "TIME" }), "25:00")).toBeTruthy();
  });
});

describe("validateAnswers", () => {
  it("collects errors keyed by field id", () => {
    const fields = [
      field({ id: "name", required: true }),
      field({ id: "age", type: "FLOAT", required: true }),
    ];
    const result = validateAnswers(fields, { name: "", age: "x" });
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(["age", "name"]);
  });

  it("passes when all answers are valid", () => {
    const fields = [field({ id: "name", required: true })];
    expect(validateAnswers(fields, { name: "Ana" }).ok).toBe(true);
  });
});
