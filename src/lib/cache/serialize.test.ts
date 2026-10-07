import { describe, expect, it } from "vitest";
import { deserializeFromCache, serializeForCache } from "./serialize";

describe("serializeForCache / deserializeFromCache (milestone 25, P2)", () => {
  it("una fila con BigInt y Date vuelve con los mismos tipos", () => {
    const row = {
      id: "x",
      createdAt: BigInt("1790770332820"),
      nested: [{ at: new Date("2026-10-07T12:00:00.000Z"), n: 3 }],
      empty: null,
      flag: true,
    };
    const back = deserializeFromCache<typeof row>(serializeForCache(row));
    expect(back).toEqual(row);
    expect(typeof back.createdAt).toBe("bigint");
    expect(back.nested[0].at).toBeInstanceOf(Date);
  });

  it("JSON.stringify solo revienta con BigInt: por eso existe esto", () => {
    expect(() => JSON.stringify({ a: BigInt(1) })).toThrow();
    expect(() => serializeForCache({ a: BigInt(1) })).not.toThrow();
  });

  it("un objeto de datos que casualmente tiene `__cache` pero más claves no se toca", () => {
    const data = { __cache: "bigint", v: "1", other: 1 };
    expect(deserializeFromCache(serializeForCache(data))).toEqual(data);
  });

  it("listas y valores sueltos", () => {
    expect(deserializeFromCache(serializeForCache([BigInt(5), "a"]))).toEqual([
      BigInt(5),
      "a",
    ]);
    expect(deserializeFromCache(serializeForCache(null))).toBeNull();
  });
});
