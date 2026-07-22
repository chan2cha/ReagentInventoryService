export type WarehouseKind = string;
export type WarehouseLabel = string;

export type WarehouseOption = {
  code: string;
  name: string;
};

export const DEFAULT_WAREHOUSES: readonly WarehouseOption[] = [
  { code: "FINISHED_GOODS", name: "완제품" },
  { code: "SAMPLE", name: "검체" },
  { code: "RETURNED", name: "반품" },
  { code: "NONCONFORMING", name: "부적합" },
  { code: "DISPOSAL", name: "폐기" }
];
/** Backward-compatible defaults for screens that do not load the master list. */
export const WAREHOUSE_KINDS = DEFAULT_WAREHOUSES.map((warehouse) => warehouse.code);

export function isWarehouseKind(value: string): value is WarehouseKind {
  return /^[A-Z][A-Z0-9_]{1,29}$/.test(value);
}

const legacyWarehouseLabels = {
  FINISHED_GOODS: "완제품",
  SAMPLE: "검체",
  RETURNED: "반품",
  NONCONFORMING: "부적합",
  DISPOSAL: "폐기"
} satisfies Record<string, string>;

export function warehouseLabel(warehouse: WarehouseKind, warehouses: readonly WarehouseOption[] = DEFAULT_WAREHOUSES) {
  return warehouses.find((item) => item.code === warehouse)?.name
    ?? legacyWarehouseLabels[warehouse as keyof typeof legacyWarehouseLabels]
    ?? warehouse;
}
