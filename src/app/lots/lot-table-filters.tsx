import {
  LOT_STATUS_KINDS,
  lotStatusLabel,
  type LotStatusKind
} from "@/domain/lot-status";
import {
  WAREHOUSE_KINDS,
  warehouseLabel,
  type WarehouseKind
} from "@/domain/warehouse";
import { TableSearch } from "../table-search";

type LotTableFiltersProps = {
  q?: string;
  status?: LotStatusKind;
  warehouse?: WarehouseKind;
};

const lotStatusOptions = [
  { label: "전체 상태", value: "" },
  ...LOT_STATUS_KINDS.map((status) => ({
    label: lotStatusLabel(status),
    value: status
  }))
];

const warehouseOptions = [
  { label: "전체 창고", value: "" },
  ...WAREHOUSE_KINDS.map((warehouse) => ({
    label: warehouseLabel(warehouse),
    value: warehouse
  }))
];

export function LotTableFilters({ q, status, warehouse }: LotTableFiltersProps) {
  return (
    <TableSearch
      description="검색어, 재고 상태와 창고를 조합해 필요한 재고만 확인하세요."
      filters={[
        {
          label: "상태",
          name: "status",
          options: lotStatusOptions,
          value: status
        },
        {
          label: "창고",
          name: "warehouse",
          options: warehouseOptions,
          value: warehouse
        }
      ]}
      pathname="/lots"
      placeholder="시약명, 코드, 제조번호 검색"
      title="재고 검색"
      value={q}
    />
  );
}
