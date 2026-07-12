import { describe, expect, it } from "vitest";
import {
  STOCK_MOVEMENT_KINDS,
  isStockMovementKind,
  stockMovementDelta,
  stockMovementTypeLabel
} from "./stock-movement-presentation";

describe("stock movement presentation", () => {
  it("provides an explicit label for every persisted movement kind", () => {
    expect(STOCK_MOVEMENT_KINDS.map((type) => [type, stockMovementTypeLabel(type)])).toEqual([
      ["IN", "입고"],
      ["OUT", "출고"],
      ["ADJUST", "조정"],
      ["DISPOSE", "폐기"],
      ["REVERSE", "출고취소/복구"]
    ]);
  });

  it("normalizes directional movement quantities and preserves signed adjustments", () => {
    expect(stockMovementDelta("IN", 5)).toBe(5);
    expect(stockMovementDelta("IN", -5)).toBe(5);
    expect(stockMovementDelta("OUT", 5)).toBe(-5);
    expect(stockMovementDelta("OUT", -5)).toBe(-5);
    expect(stockMovementDelta("REVERSE", 5)).toBe(5);
    expect(stockMovementDelta("REVERSE", -5)).toBe(5);
    expect(stockMovementDelta("ADJUST", 5)).toBe(5);
    expect(stockMovementDelta("ADJUST", -5)).toBe(-5);
    expect(stockMovementDelta("DISPOSE", -5)).toBe(-5);
  });

  it("recognizes only supported movement kinds", () => {
    expect(isStockMovementKind("REVERSE")).toBe(true);
    expect(isStockMovementKind("reverse")).toBe(false);
    expect(isStockMovementKind("")).toBe(false);
  });
});
