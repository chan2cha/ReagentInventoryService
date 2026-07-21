import { requireUser } from "@/lib/auth";
import { AppShell, Panel, Table } from "../reagent-ui";
import { SubmitButton } from "../submit-button";
import { createClient, toggleClientActive, updateClient } from "./actions";
import { clientSourceLabel, getClientRows } from "./client-data";
import { parsePage } from "@/lib/pagination"; import { Pagination } from "../pagination";
import { RegistrationDialog } from "../registration-dialog";
import { TableSearch } from "../table-search";
import { FlashMessage } from "../flash-message";
import { getFlashMessage } from "@/lib/flash-message";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams?: Promise<{ page?: string; q?: string }> }) {
  const params=await searchParams; const [user,data,flash]=await Promise.all([requireUser(),getClientRows(parsePage(params?.page), params?.q?.trim()),getFlashMessage()]); const clientRows=data.rows;
  const canManage = user.role === "ADMIN";

  return (
    <AppShell active="/clients" title="거래처 관리" description="주문과 출고에 사용하는 거래처 정보를 관리합니다.">
      <FlashMessage value={flash} />

      {canManage ? <div className="page-toolbar"><RegistrationDialog title="거래처 등록" triggerLabel="거래처 등록"><form action={createClient} className="entry-form compact-entry-form"><label>거래처명<input name="name" placeholder="병원 또는 기관명" required /></label><label>지역<input name="region" placeholder="예: 서울 종로구" /></label><label>담당자<input name="managerName" placeholder="선택 입력" /></label><label>납품과<input name="deliveryDepartment" placeholder="예: 진단검사의학과" /></label><label>메모<textarea name="memo" placeholder="거래처 관련 참고사항" /></label><div className="form-actions"><SubmitButton className="primary-button" pendingLabel="등록 중...">등록</SubmitButton></div></form></RegistrationDialog></div> : null}
      <TableSearch pathname="/clients" placeholder="거래처명, 지역, 담당자, 납품과, 메모 검색" value={params?.q} />
      <div>
        <Panel title="거래처 목록" note={clientSourceLabel(clientRows)}>
          <Table>
            <thead><tr><th>거래처명</th><th>지역</th><th>담당자</th><th>납품과</th><th>메모</th>{canManage ? <th>관리</th> : null}</tr></thead>
            <tbody>
              {clientRows.map((client) => (
                <tr key={client.id}>
                  {canManage && client.source === "database" ? (
                    <td colSpan={5}>
                      <div className="table-edit-form client-edit-form">
                        <input aria-label="거래처명" defaultValue={client.name} form={`client-${client.id}`} name="name" required />
                        <input aria-label="지역" defaultValue={client.region === "-" ? "" : client.region} form={`client-${client.id}`} name="region" />
                        <input aria-label="담당자" defaultValue={client.manager === "-" ? "" : client.manager} form={`client-${client.id}`} name="managerName" />
                        <input aria-label="납품과" defaultValue={client.deliveryDepartment === "-" ? "" : client.deliveryDepartment} form={`client-${client.id}`} name="deliveryDepartment" />
                        <input aria-label="메모" defaultValue={client.memo} form={`client-${client.id}`} name="memo" />
                      </div>
                    </td>
                  ) : (
                    <><td>{client.name}</td><td>{client.region}</td><td>{client.manager}</td><td>{client.deliveryDepartment}</td><td>{client.memo || "-"}</td></>
                  )}
                  {canManage ? <td><div className="table-actions">
                    {client.source === "database" ? <form action={updateClient} id={`client-${client.id}`}>
                      <input name="clientId" type="hidden" value={client.id} />
                      <SubmitButton className="table-action" pendingLabel="저장 중...">저장</SubmitButton>
                    </form> : null}
                    <form action={toggleClientActive}><input name="clientId" type="hidden" value={client.id} /><SubmitButton className={client.active ? "table-action danger" : "table-action"} confirmMessage={`${client.name} 거래처를 ${client.active ? "비활성화" : "활성화"}하시겠습니까?`}>{client.active ? "비활성화" : "활성화"}</SubmitButton></form>
                  </div></td> : null}
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <Pagination page={data.page} pathname="/clients" preserve={{ q: params?.q }} total={data.total} totalPages={data.totalPages} />
      </div>
    </AppShell>
  );
}
