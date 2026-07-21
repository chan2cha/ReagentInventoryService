import {
  STOCK_MOVEMENT_KINDS,
  stockMovementTypeLabel,
  type StockMovementKind
} from "@/domain/stock-movement-presentation";
import {
  WAREHOUSE_KINDS,
  warehouseLabel,
  type WarehouseKind
} from "@/domain/warehouse";
import { TableSearch } from "../table-search";

type MovementTableFiltersProps = {
  q?: string;
  type?: StockMovementKind;
  warehouse?: WarehouseKind;
};

const movementTypeOptions = [
  { label: "전체 구분", value: "" },
  ...STOCK_MOVEMENT_KINDS.map((kind) => ({
    label: stockMovementTypeLabel(kind),
    value: kind
  }))
];

const warehouseOptions = [
  { label: "전체 창고", value: "" },
  ...WAREHOUSE_KINDS.map((warehouse) => ({
    label: warehouseLabel(warehouse),
    value: warehouse
  }))
];

export function MovementTableFilters({ q, type, warehouse }: MovementTableFiltersProps) {
  return (
    <TableSearch
      description="검색어와 구분을 조합해 원하는 이력만 확인하세요."
      filters={[
        {
          label: "구분",
          name: "type",
          options: movementTypeOptions,
          value: type
        },
        {
          label: "창고",
          name: "warehouse",
          options: warehouseOptions,
          value: warehouse
        }
      ]}
      pathname="/movements"
      placeholder="시약명, 코드, 제조번호, 사유 검색"
      title="이력 검색"
      value={q}
    />
  );
}
