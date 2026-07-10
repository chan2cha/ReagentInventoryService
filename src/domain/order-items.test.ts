import { describe, expect, it } from "vitest";
import { normalizeOrderItems } from "./order-items";

describe("normalizeOrderItems", () => {
  it("merges duplicate allergen rows", () => {
    expect(
      normalizeOrderItems([
        { allergenId: "EGG", quantity: "2" },
        { allergenId: "MILK", quantity: "3" },
        { allergenId: "EGG", quantity: "4" }
      ])
    ).toEqual([
      { allergenId: "EGG", quantity: 6 },
      { allergenId: "MILK", quantity: 3 }
    ]);
  });

  it("rejects empty allergen rows", () => {
    expect(() => normalizeOrderItems([{ allergenId: "", quantity: "1" }])).toThrow("ORDER_ITEM_ALLERGEN_REQUIRED");
  });

  it("rejects invalid quantities", () => {
    expect(() => normalizeOrderItems([{ allergenId: "EGG", quantity: "0" }])).toThrow("ORDER_ITEM_QUANTITY_INVALID");
  });
});
