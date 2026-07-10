import { describe, expect, it } from "vitest";
import { nextStockQuantity, signedAdjustmentQuantity } from "./stock-adjustment";

describe("nextStockQuantity", () => {
  it("prevents negative stock", () => {
    expect(() => nextStockQuantity(3, -4)).toThrow("ADJUSTMENT_STOCK_NEGATIVE");
  });
});

describe("signedAdjustmentQuantity", () => {
  it("converts an explicit operation and positive quantity to a signed adjustment", () => {
    expect(signedAdjustmentQuantity("ADD", "5")).toBe(5);
    expect(signedAdjustmentQuantity("REMOVE", "2")).toBe(-2);
    expect(signedAdjustmentQuantity("DISPOSE", "3")).toBe(-3);
  });

  it("rejects zero, negative, and non-numeric quantities", () => {
    expect(() => signedAdjustmentQuantity("ADD", "0")).toThrow("ADJUSTMENT_QUANTITY_INVALID");
    expect(() => signedAdjustmentQuantity("REMOVE", "-2")).toThrow("ADJUSTMENT_QUANTITY_INVALID");
    expect(() => signedAdjustmentQuantity("DISPOSE", "abc")).toThrow("ADJUSTMENT_QUANTITY_INVALID");
  });
});
