import { describe, expect, it } from "vitest";
import { reorderInputSchema } from "./reorder";

describe("reorderInputSchema", () => {
  it("acepta una lista de ids sin repetidos", () => {
    expect(
      reorderInputSchema.safeParse({ orderedIds: ["a", "b", "c"] }).success,
    ).toBe(true);
  });

  it("rechaza una lista vacía o con repetidos", () => {
    expect(reorderInputSchema.safeParse({ orderedIds: [] }).success).toBe(
      false,
    );
    expect(
      reorderInputSchema.safeParse({ orderedIds: ["a", "b", "a"] }).success,
    ).toBe(false);
  });
});
