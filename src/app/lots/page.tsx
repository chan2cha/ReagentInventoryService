import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { formatDate, getLotRows, lotSourceLabel } from "./lot-data";
import { StockAdjustmentDialog } from "./stock-adjustment-dialog";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { parsePage } from "@/lib/pagination"; import { Pagination } from "../pagination";
import { ExportDownloadButton } from "../exports/export-download-button";
import { isLotStatusKind, lotStatusLabel } from "@/domain/lot-status";
import { LotTableFilters } from "./lot-table-filters";
import { FlashMessage } from "../flash-message";
import { getFlashMessage } from "@/lib/flash-message";

export const dynamic = "force-dynamic";

export default async function LotsPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const [user, flash] = await Promise.all([requireUser(), getFlashMessage()]);
  const statusParam = params?.status?.trim() ?? "";
  const lotStatus = isLotStatusKind(statusParam) ? statusParam : undefined;
  const data = await getLotRows(parsePage(params?.page), params?.q?.trim(), lotStatus);
  const lotRows = data.rows;
  const canWrite = can(user.role, "STOCK_WRITE");
  const canExport = can(user.role, "DATA_EXPORT");

  return (
    <AppShell
      active="/lots"
      title="재고 현황"
      description="시약별 제조번호, 유통기한, 현재 수량을 확인합니다."
      action={canWrite ? "입고 등록" : undefined}
      actionHref={canWrite ? "/receiving" : undefined}
    >
      <FlashMessage value={flash} />
      <div className="table-filter-toolbar extended-filter-toolbar">
        <LotTableFilters q={params?.q} status={lotStatus} />
        {canExport ? (
          <ExportDownloadButton
            fallbackFileName="재고-현황.xlsx"
            label="현재 조건 엑셀"
            query={{ report: "inventory", q: params?.q, status: lotStatus }}
          />
        ) : null}
      </div>
      <Panel title="입고분 목록" note={`${lotSourceLabel(lotRows)} · 유통기한 빠른 순${lotStatus ? ` · ${lotStatusLabel(lotStatus)}` : ""}`}>
        <Table>
          <thead>
            <tr>
              <th>시약명</th>
              <th>제조번호</th>
              <th>입고일</th>
              <th>유통기한</th>
              <th>현재 수량</th>
              <th>입고 수량</th>
              <th>안전 수량</th>
              <th>상태</th>
              {canWrite ? <th>재고 조정</th> : null}
            </tr>
          </thead>
          <tbody>
            {lotRows.map((lot) => (
              <tr key={lot.id}>
                <td>
                  <span className="stacked">
                    <strong>{lot.allergenName}</strong>
                    <small>{lot.allergenCode}</small>
                  </span>
                </td>
                <td>{lot.lotNo}</td>
                <td>{formatDate(lot.receivedDate)}</td>
                <td>{formatDate(lot.expirationDate)}</td>
                <td>{lot.currentQuantity}</td>
                <td>{lot.initialQuantity}</td>
                <td>{lot.minStock ?? "-"}</td>
                <td><StatusBadge status={lot.status} /></td>
                {canWrite ? <td>
                  <StockAdjustmentDialog allergenCode={lot.allergenCode} allergenName={lot.allergenName} currentQuantity={lot.currentQuantity} disabled={lot.source !== "database"} expirationDate={formatDate(lot.expirationDate)} lotId={lot.id} lotNo={lot.lotNo} minStock={lot.minStock} />
                </td> : null}
              </tr>
            ))}
          </tbody>
        </Table>
        <Pagination page={data.page} pathname="/lots" preserve={{ q: params?.q, status: lotStatus }} total={data.total} totalPages={data.totalPages} />
      </Panel>
    </AppShell>
  );
}
