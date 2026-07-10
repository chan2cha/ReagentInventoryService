import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { formatDate, getMovementRows, movementSourceLabel } from "./movement-data";
import { parsePage } from "@/lib/pagination"; import { Pagination } from "../pagination";
import { TableSearch } from "../table-search";

export const dynamic = "force-dynamic";

export default async function MovementsPage({ searchParams }: { searchParams?: Promise<{ page?: string; q?: string }> }) {
  const params = await searchParams; const data = await getMovementRows(parsePage(params?.page), params?.q?.trim()); const movementRows = data.rows;

  return (
    <AppShell
      active="/movements"
      title="입출고 이력"
      description="입고, 출고, 조정, 폐기 내역을 제조번호별로 확인합니다."
    >
      <TableSearch pathname="/movements" placeholder="시약명, 코드, 제조번호, 사유 검색" value={params?.q} />
      <Panel title="재고 이동 이력" note={`${movementSourceLabel(movementRows)} · 최신순`}>
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
        <Pagination page={data.page} pathname="/movements" preserve={{ q: params?.q }} total={data.total} totalPages={data.totalPages} />
      </Panel>
    </AppShell>
  );
}
