import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { formatDate, getMovementRows, movementSourceLabel } from "./movement-data";
import { can } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import {
  isStockMovementKind,
  stockMovementTypeLabel
} from "@/domain/stock-movement-presentation";
import { parsePage } from "@/lib/pagination"; import { Pagination } from "../pagination";
import { ExportDownloadButton } from "../exports/export-download-button";
import { MovementTableFilters } from "./movement-table-filters";

export const dynamic = "force-dynamic";

export default async function MovementsPage({ searchParams }: { searchParams?: Promise<{ page?: string; q?: string; type?: string }> }) {
  const params = await searchParams;
  const user = await requireUser();
  const typeParam = params?.type?.trim() ?? "";
  const movementType = isStockMovementKind(typeParam) ? typeParam : undefined;
  const data = await getMovementRows(parsePage(params?.page), params?.q?.trim(), movementType);
  const movementRows = data.rows;
  const canExport = can(user.role, "DATA_EXPORT");

  return (
    <AppShell
      active="/movements"
      title="입출고 이력"
      description="입고, 출고, 조정, 폐기 및 출고취소/복구 내역을 제조번호별로 확인합니다."
    >
      <div className="table-filter-toolbar extended-filter-toolbar">
        <MovementTableFilters q={params?.q} type={movementType} />
        {canExport ? (
          <ExportDownloadButton
            fallbackFileName="입출고-이력.xlsx"
            label="현재 조건 엑셀"
            query={{ report: "movements", q: params?.q, type: movementType }}
          />
        ) : null}
      </div>
      <Panel title="재고 이동 이력" note={`${movementSourceLabel(movementRows)} · 최신순${movementType ? ` · ${stockMovementTypeLabel(movementType)}` : ""}`}>
        <Table>
          <thead>
            <tr>
              <th>일자</th>
              <th>구분</th>
              <th>시약명</th>
              <th>제조번호</th>
              <th>수량</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {movementRows.map((movement) => (
              <tr key={movement.id}>
                <td>{formatDate(movement.date)}</td>
                <td><StatusBadge status={movement.type} /></td>
                <td>
                  <span className="stacked">
                    <strong>{movement.allergenName}</strong>
                    <small>{movement.allergenCode}</small>
                  </span>
                </td>
                <td>{movement.lotNo}</td>
                <td>{movement.quantity}</td>
                <td>{movement.memo}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pagination page={data.page} pathname="/movements" preserve={{ q: params?.q, type: movementType }} total={data.total} totalPages={data.totalPages} />
      </Panel>
    </AppShell>
  );
}
