import {
  LOT_STATUS_KINDS,
  lotStatusLabel,
  type LotStatusFilter
} from "@/domain/lot-status";
import type { WarehouseKind, WarehouseOption } from "@/domain/warehouse";
import { TableSearch } from "../table-search";
import { DEFAULT_LOT_SORT, type LotSortKind } from "./lot-data";

type LotTableFiltersProps = {
  q?: string;
  status?: LotStatusFilter;
  warehouse?: WarehouseKind;
  sort: LotSortKind;
  warehouses: readonly WarehouseOption[];
};

const lotStatusOptions = [
  { label: "재고 보유", value: "" },
  { label: "전체 상태", value: "ALL" },
  ...LOT_STATUS_KINDS.map((status) => ({
    label: lotStatusLabel(status),
    value: status
  }))
];

export function LotTableFilters({ q, status, warehouse, sort, warehouses }: LotTableFiltersProps) {
  return (
    <TableSearch
      description="검색어, 재고 상태와 창고를 조합해 필요한 재고를 확인하세요."
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
          options: [{ label: "전체 창고", value: "" }, ...warehouses.map((item) => ({ label: item.name, value: item.code }))],
          value: warehouse
        }
      ]}
      pathname="/lots"
      placeholder="시약명, 코드, 제조번호 검색"
      preserve={{ sort: sort === DEFAULT_LOT_SORT ? undefined : sort }}
      title="재고 검색"
      value={q}
    />
  );
}
