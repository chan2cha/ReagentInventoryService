export const WAREHOUSE_KINDS = [
  "FINISHED_GOODS",
  "SAMPLE",
  "RETURNED",
  "NONCONFORMING",
  "DISPOSAL"
] as const;

export type WarehouseKind = (typeof WAREHOUSE_KINDS)[number];
export type WarehouseLabel = "완제품" | "검체" | "반품" | "부적합" | "폐기";

const warehouseLabels = {
  FINISHED_GOODS: "완제품",
  SAMPLE: "검체",
  RETURNED: "반품",
  NONCONFORMING: "부적합",
  DISPOSAL: "폐기"
} satisfies Record<WarehouseKind, WarehouseLabel>;

export function isWarehouseKind(value: string): value is WarehouseKind {
  return (WAREHOUSE_KINDS as readonly string[]).includes(value);
}

export function warehouseLabel(warehouse: WarehouseKind): WarehouseLabel {
  return warehouseLabels[warehouse];
}
