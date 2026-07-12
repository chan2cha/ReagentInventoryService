import {
  STOCK_MOVEMENT_KINDS,
  stockMovementTypeLabel,
  type StockMovementKind
} from "@/domain/stock-movement-presentation";
import { TableSearch } from "../table-search";

type MovementTableFiltersProps = {
  q?: string;
  type?: StockMovementKind;
};

const movementTypeOptions = [
  { label: "전체 구분", value: "" },
  ...STOCK_MOVEMENT_KINDS.map((kind) => ({
    label: stockMovementTypeLabel(kind),
    value: kind
  }))
];

export function MovementTableFilters({ q, type }: MovementTableFiltersProps) {
  return (
    <TableSearch
      description="검색어와 구분을 조합해 원하는 이력만 확인하세요."
      filter={{
        label: "구분",
        name: "type",
        options: movementTypeOptions,
        value: type
      }}
      pathname="/movements"
      placeholder="시약명, 코드, 제조번호, 사유 검색"
      title="이력 검색"
      value={q}
    />
  );
}
