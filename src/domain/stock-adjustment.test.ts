import { describe, expect, it } from "vitest";
import { nextStockQuantity, parseAdjustmentQuantity } from "./stock-adjustment";

describe("parseAdjustmentQuantity", () => {
  it("parses signed adjustment quantities", () => {
    expect(parseAdjustmentQuantity("+5")).toBe(5);
    expect(parseAdjustmentQuantity("-2")).toBe(-2);
  });

  it("rejects zero quantities", () => {
    expect(() => parseAdjustmentQuantity("0")).toThrow("ADJUSTMENT_QUANTITY_INVALID");
  });
});

describe("nextStockQuantity", () => {
  it("prevents negative stock", () => {
    expect(() => nextStockQuantity(3, -4)).toThrow("ADJUSTMENT_STOCK_NEGATIVE");
  });
});
