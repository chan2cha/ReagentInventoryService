import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { formatDate, getLotRows, lotSourceLabel } from "./lot-data";
import { StockAdjustmentDialog } from "./stock-adjustment-dialog";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { parsePage } from "@/lib/pagination"; import { Pagination } from "../pagination";
import { TableSearch } from "../table-search";

export const dynamic = "force-dynamic";

export default async function LotsPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; success?: string; page?: string; q?: string }>;
}) {
  const params=await searchParams; const [user,data]=await Promise.all([requireUser(),getLotRows(parsePage(params?.page), params?.q?.trim())]); const lotRows=data.rows;
  const canWrite = can(user.role, "STOCK_WRITE");
  const error = params?.error;
  const success = params?.success;

  return (
    <AppShell
      active="/lots"
      title="재고 현황"
      description="시약별 제조번호, 유통기한, 현재 수량을 확인합니다."
      action={canWrite ? "입고 등록" : undefined}
      actionHref={canWrite ? "/receiving" : undefined}
    >
      {error ? <div className="page-alert">{error}</div> : null}
      {success ? <div className="page-alert success">{success}</div> : null}
      <TableSearch pathname="/lots" placeholder="시약명, 코드, 제조번호 검색" value={params?.q} />
      <Panel title="입고분 목록" note={`${lotSourceLabel(lotRows)} · 유통기한 빠른 순`}>
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
        <Pagination page={data.page} pathname="/lots" preserve={{ q: params?.q }} total={data.total} totalPages={data.totalPages} />
      </Panel>
    </AppShell>
  );
}
