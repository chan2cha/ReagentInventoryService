import { requireUser } from "@/lib/auth";
import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { SubmitButton } from "../submit-button";
import { createAllergen, toggleAllergenActive, updateAllergen } from "./actions";
import { allergenSourceLabel, getAllergenRows } from "./allergen-data";
import { parsePage } from "@/lib/pagination"; import { Pagination } from "../pagination";
import { TableSearch } from "../table-search";

export const dynamic = "force-dynamic";

export default async function AllergensPage({ searchParams }: { searchParams?: Promise<{ error?: string; success?: string; page?: string; q?: string }> }) {
  const params=await searchParams; const [user,data]=await Promise.all([requireUser(),getAllergenRows(parsePage(params?.page), params?.q?.trim())]); const allergenRows=data.rows;
  const canManage = user.role === "ADMIN";

  return (
    <AppShell active="/allergens" title="시약 관리" description="검사 시약과 안전 수량 기준을 관리합니다.">
      {params?.error ? <div className="page-alert">{params.error}</div> : null}
      {params?.success ? <div className="page-alert success">{params.success}</div> : null}

      <TableSearch pathname="/allergens" placeholder="시약 코드, 시약명, 분류 검색" value={params?.q} />
      <div className={canManage ? "form-layout master-data-layout" : undefined}>
        <Panel title="시약 목록" note={allergenSourceLabel(allergenRows)}>
          <Table>
            <thead>
              <tr>
                <th>코드</th><th>시약명</th><th>분류</th><th>안전 수량</th><th>입고 건수</th><th>상태</th>
                {canManage ? <th>관리</th> : null}
              </tr>
            </thead>
            <tbody>
              {allergenRows.map((allergen) => (
                <tr key={allergen.id}>
                  {canManage && allergen.source === "database" ? (
                    <>
                      <td colSpan={4}>
                        <form action={updateAllergen} className="table-edit-form allergen-edit-form" id={`allergen-${allergen.id}`}>
                          <input name="allergenId" type="hidden" value={allergen.id} />
                          <input aria-label="시약 코드" defaultValue={allergen.code} maxLength={30} name="code" required />
                          <input aria-label="시약명" defaultValue={allergen.name} name="name" required />
                          <input aria-label="분류" defaultValue={allergen.category === "-" ? "" : allergen.category} name="category" />
                          <input aria-label="안전 수량" defaultValue={allergen.minStock ?? 0} min={0} name="minStock" required type="number" />
                        </form>
                      </td>
                    </>
                  ) : (
                    <><td>{allergen.code}</td><td>{allergen.name}</td><td>{allergen.category}</td><td>{allergen.minStock ?? "-"}</td></>
                  )}
                  <td>{allergen.lotCount}</td>
                  <td><StatusBadge status={allergen.active ? "정상" : "취소"} /></td>
                  {canManage ? (
                    <td><div className="table-actions">
                      <SubmitButton className="table-action" form={`allergen-${allergen.id}`} pendingLabel="저장 중...">저장</SubmitButton>
                      <form action={toggleAllergenActive}>
                        <input name="allergenId" type="hidden" value={allergen.id} />
                        <SubmitButton className={allergen.active ? "table-action danger" : "table-action"} confirmMessage={`${allergen.name} 시약을 ${allergen.active ? "비활성화" : "활성화"}하시겠습니까?`}>{allergen.active ? "비활성화" : "활성화"}</SubmitButton>
                      </form>
                    </div></td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <Pagination page={data.page} pathname="/allergens" preserve={{ q: params?.q }} total={data.total} totalPages={data.totalPages} />

        {canManage ? <Panel title="시약 등록" note="관리자 전용">
          <form action={createAllergen} className="entry-form compact-entry-form">
            <label>시약 코드<input maxLength={30} name="code" placeholder="예: HDM-D1" required /></label>
            <label>시약명<input name="name" placeholder="시약명" required /></label>
            <label>분류<input name="category" placeholder="예: 흡입성" /></label>
            <label>안전 수량<input defaultValue={0} min={0} name="minStock" required type="number" /></label>
            <div className="form-actions"><SubmitButton className="primary-button" pendingLabel="등록 중...">시약 등록</SubmitButton></div>
          </form>
        </Panel> : null}
      </div>
    </AppShell>
  );
}
