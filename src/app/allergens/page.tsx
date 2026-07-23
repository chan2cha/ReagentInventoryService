import { requireUser } from "@/lib/auth";
import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { SubmitButton } from "../submit-button";
import { toggleAllergenActive } from "./actions";
import { allergenSourceLabel, getAllergenRows } from "./allergen-data";
import { parsePage } from "@/lib/pagination"; import { Pagination } from "../pagination";
import { TableSearch } from "../table-search";
import { FlashMessage } from "../flash-message";
import { getFlashMessage } from "@/lib/flash-message";
import { CreateAllergenDialog } from "./create-allergen-dialog";
import { EditAllergenDialog } from "./edit-allergen-dialog";

export const dynamic = "force-dynamic";

export default async function AllergensPage({ searchParams }: { searchParams?: Promise<{ page?: string; q?: string }> }) {
  const params=await searchParams; const [user,data,flash]=await Promise.all([requireUser(),getAllergenRows(parsePage(params?.page), params?.q?.trim()),getFlashMessage()]); const allergenRows=data.rows;
  const canManage = user.role === "ADMIN";

  return (
    <AppShell active="/allergens" title="시약 관리" description="검사에 사용하는 시약 정보를 관리합니다.">
      <FlashMessage value={flash} />

      <div className="table-filter-toolbar extended-filter-toolbar allergen-toolbar">
        <TableSearch pathname="/allergens" placeholder="시약 코드, 시약명, 분류 검색" value={params?.q} />
        {canManage ? <CreateAllergenDialog /> : null}
      </div>
      <div className="allergen-page-body">
        <Panel title="시약 목록" note={allergenSourceLabel(allergenRows)}>
          <Table>
            <thead>
              <tr>
                <th>시약 코드</th><th>시약 정보</th><th>LOT 수</th><th>상태</th>
                {canManage ? <th>관리</th> : null}
              </tr>
            </thead>
            <tbody>
              {allergenRows.map((allergen) => (
                <tr key={allergen.id}>
                  <td><code className="allergen-code">{allergen.code}</code></td>
                  <td><span className="stacked allergen-name"><strong>{allergen.name}</strong><small>{allergen.category === "-" ? "분류 없음" : allergen.category}</small></span></td>
                  <td><span className="allergen-lot-count">{allergen.lotCount}<small>LOT</small></span></td>
                  <td><StatusBadge status={allergen.active ? "정상" : "취소"} /></td>
                  {canManage ? (
                    <td><div className="table-actions">
                      {allergen.source === "database" ? <><EditAllergenDialog allergen={allergen} /><form action={toggleAllergenActive}>
                        <input name="allergenId" type="hidden" value={allergen.id} />
                        <SubmitButton className={allergen.active ? "table-action danger" : "table-action"} confirmMessage={`${allergen.name} 시약을 ${allergen.active ? "비활성화" : "활성화"}하시겠습니까?`}>{allergen.active ? "비활성화" : "활성화"}</SubmitButton>
                      </form></> : <span className="table-muted">예시 데이터</span>}
                    </div></td>
                  ) : null}
                </tr>
              ))}
              {allergenRows.length === 0 ? <tr><td colSpan={canManage ? 5 : 4} className="table-empty">검색 조건에 맞는 시약이 없습니다.</td></tr> : null}
            </tbody>
          </Table>
        </Panel>
        <Pagination page={data.page} pathname="/allergens" preserve={{ q: params?.q }} total={data.total} totalPages={data.totalPages} />
      </div>
    </AppShell>
  );
}
