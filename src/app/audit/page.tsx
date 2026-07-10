import { requirePageRole } from "@/lib/auth";
import { AppShell, Panel, Table } from "../reagent-ui";
import { getAuditRows } from "./audit-data";
import { parsePage } from "@/lib/pagination";
import { Pagination } from "../pagination";
import { TableSearch } from "../table-search";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams?: Promise<{ page?: string; q?: string }> }) {
  await requirePageRole(["ADMIN"]);
  const params = await searchParams;
  const data = await getAuditRows(parsePage(params?.page), params?.q?.trim());

  return (
    <AppShell active="/audit" title="감사 로그" description="중요 업무와 관리자 계정 작업의 처리 이력을 확인합니다.">
      <TableSearch pathname="/audit" placeholder="작업, 내용, 처리자 검색" value={params?.q} />
      <Panel title="최근 감사 기록" note="최신순 · 페이지당 20건">
        <Table>
          <thead><tr><th>처리 시각</th><th>작업</th><th>대상</th><th>상세 내용</th><th>처리자</th></tr></thead>
          <tbody>
            {data.rows.map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.action}</td><td>{row.entityType}</td><td>{row.description}</td><td>{row.actor}</td></tr>)}
            {data.rows.length === 0 ? <tr><td colSpan={5}>감사 기록이 없습니다.</td></tr> : null}
          </tbody>
        </Table>
        <Pagination page={data.page} pathname="/audit" preserve={{q:params?.q}} total={data.total} totalPages={data.totalPages} />
      </Panel>
    </AppShell>
  );
}
