import { requireUser } from "@/lib/auth";
import { AppShell, Panel, Table } from "../reagent-ui";
import { SubmitButton } from "../submit-button";
import { createClient, toggleClientActive } from "./actions";
import { clientSourceLabel, getClientRows } from "./client-data";
import { parsePage } from "@/lib/pagination";
import { Pagination } from "../pagination";
import { RegistrationDialog } from "../registration-dialog";
import { TableSearch } from "../table-search";
import { FlashMessage } from "../flash-message";
import { getFlashMessage } from "@/lib/flash-message";
import { EditClientDialog } from "./edit-client-dialog";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams?: Promise<{ page?: string; q?: string }> }) {
  const params = await searchParams;
  const [user, data, flash] = await Promise.all([
    requireUser(),
    getClientRows(parsePage(params?.page), params?.q?.trim()),
    getFlashMessage()
  ]);
  const clientRows = data.rows;
  const canManage = user.role === "ADMIN";

  return (
    <AppShell active="/clients" title="거래처 관리" description="주문과 출고에 사용하는 거래처 정보를 관리합니다.">
      <FlashMessage value={flash} />

      <div className="table-filter-toolbar extended-filter-toolbar clients-toolbar">
        <TableSearch pathname="/clients" placeholder="거래처명, 지역, 담당자, 납품과, 메모 검색" value={params?.q} />
        {canManage ? (
          <RegistrationDialog dialogClassName="client-create-dialog" title="거래처 등록" triggerLabel="거래처 등록">
            <form action={createClient} className="entry-form compact-entry-form">
              <label><span>거래처명</span><input name="name" placeholder="병원 또는 기관명" required /></label>
              <label><span>지역</span><input name="region" placeholder="예: 서울 종로구" /></label>
              <label><span>담당자</span><input name="managerName" placeholder="선택 입력" /></label>
              <label><span>납품과</span><input name="deliveryDepartment" placeholder="예: 진단검사의학과" /></label>
              <label><span>메모</span><textarea name="memo" placeholder="거래처 관리 참고사항" /></label>
              <div className="form-actions">
                <button className="secondary-button" data-dialog-close type="button">취소</button>
                <SubmitButton className="primary-button" pendingLabel="등록 중...">등록</SubmitButton>
              </div>
            </form>
          </RegistrationDialog>
        ) : null}
      </div>

      <div className="client-page-body">
        <Panel title="거래처 목록" note={clientSourceLabel(clientRows)}>
          <Table>
            <thead>
              <tr>
                <th>거래처</th><th>담당 / 납품과</th><th>메모</th><th>상태</th>
                {canManage ? <th>관리</th> : null}
              </tr>
            </thead>
            <tbody>
              {clientRows.map((client) => (
                <tr key={client.id}>
                  <td>
                    <span className="stacked client-name">
                      <strong>{client.name}</strong>
                      <small>{client.region === "-" ? "지역 미등록" : client.region}</small>
                    </span>
                  </td>
                  <td>
                    <span className="stacked client-contact">
                      <strong>{client.manager === "-" ? "담당자 미등록" : client.manager}</strong>
                      <small>{client.deliveryDepartment === "-" ? "납품과 미등록" : client.deliveryDepartment}</small>
                    </span>
                  </td>
                  <td className="client-memo">{client.memo || "-"}</td>
                  <td><span className={`status-badge ${client.active ? "ok" : "muted"}`}>{client.active ? "활성" : "비활성"}</span></td>
                  {canManage ? (
                    <td>
                      <div className="table-actions">
                        {client.source === "database" ? (
                          <>
                            <EditClientDialog client={client} />
                            <form action={toggleClientActive}>
                              <input name="clientId" type="hidden" value={client.id} />
                              <SubmitButton
                                className={client.active ? "table-action danger" : "table-action"}
                                confirmMessage={`${client.name} 거래처를 ${client.active ? "비활성화" : "활성화"}하시겠습니까?`}
                              >
                                {client.active ? "비활성화" : "활성화"}
                              </SubmitButton>
                            </form>
                          </>
                        ) : <span className="table-muted">예시 데이터</span>}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {clientRows.length === 0 ? <tr><td className="table-empty" colSpan={canManage ? 5 : 4}>검색 조건에 맞는 거래처가 없습니다.</td></tr> : null}
            </tbody>
          </Table>
        </Panel>
        <Pagination page={data.page} pathname="/clients" preserve={{ q: params?.q }} total={data.total} totalPages={data.totalPages} />
      </div>
    </AppShell>
  );
}
