import { describe, expect, it } from "vitest";
import {
  isWarehouseKind,
  WAREHOUSE_KINDS,
  warehouseLabel
} from "./warehouse";

describe("warehouse", () => {
  it("defines the five supported warehouses in a stable order", () => {
    expect(WAREHOUSE_KINDS).toEqual([
      "FINISHED_GOODS",
      "SAMPLE",
      "RETURNED",
      "NONCONFORMING",
      "DISPOSAL"
    ]);
  });

  it.each([
    ["FINISHED_GOODS", "완제품"],
    ["SAMPLE", "검체"],
    ["RETURNED", "반품"],
    ["NONCONFORMING", "부적합"],
    ["DISPOSAL", "폐기"]
  ] as const)("maps %s to its Korean label", (warehouse, label) => {
    expect(isWarehouseKind(warehouse)).toBe(true);
    expect(warehouseLabel(warehouse)).toBe(label);
  });

  it("accepts a valid custom warehouse code and rejects malformed values", () => {
    expect(isWarehouseKind("QUARANTINE")).toBe(true);
    expect(isWarehouseKind("")).toBe(false);
    expect(isWarehouseKind("cold-storage")).toBe(false);
  });
});
