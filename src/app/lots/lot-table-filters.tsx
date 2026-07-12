import {
  LOT_STATUS_KINDS,
  lotStatusLabel,
  type LotStatusKind
} from "@/domain/lot-status";
import { TableSearch } from "../table-search";

type LotTableFiltersProps = {
  q?: string;
  status?: LotStatusKind;
};

const lotStatusOptions = [
  { label: "전체 상태", value: "" },
  ...LOT_STATUS_KINDS.map((status) => ({
    label: lotStatusLabel(status),
    value: status
  }))
];

export function LotTableFilters({ q, status }: LotTableFiltersProps) {
  return (
    <TableSearch
      description="검색어와 재고 상태를 조합해 필요한 입고분만 확인하세요."
      filter={{
        label: "상태",
        name: "status",
        options: lotStatusOptions,
        value: status
      }}
      pathname="/lots"
      placeholder="시약명, 코드, 제조번호 검색"
      title="재고 검색"
      value={q}
    />
  );
}
