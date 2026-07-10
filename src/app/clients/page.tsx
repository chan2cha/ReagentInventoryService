import { requireUser } from "@/lib/auth";
import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { SubmitButton } from "../submit-button";
import { createClient, toggleClientActive, updateClient } from "./actions";
import { clientSourceLabel, getClientRows } from "./client-data";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams?: Promise<{ error?: string; success?: string }> }) {
  const [user, clientRows, params] = await Promise.all([requireUser(), getClientRows(), searchParams]);
  const canManage = user.role === "ADMIN";

  return (
    <AppShell active="/clients" title="거래처 관리" description="주문과 출고에 사용하는 거래처 정보를 관리합니다.">
      {params?.error ? <div className="page-alert">{params.error}</div> : null}
      {params?.success ? <div className="page-alert success">{params.success}</div> : null}

      <div className={canManage ? "form-layout master-data-layout" : undefined}>
        <Panel title="거래처 목록" note={clientSourceLabel(clientRows)}>
          <Table>
            <thead><tr><th>거래처</th><th>담당자</th><th>연락처</th><th>주소</th><th>주문 수</th><th>상태</th>{canManage ? <th>관리</th> : null}</tr></thead>
            <tbody>
              {clientRows.map((client) => (
                <tr key={client.id}>
                  {canManage && client.source === "database" ? (
                    <td colSpan={4}>
                      <form action={updateClient} className="table-edit-form client-edit-form" id={`client-${client.id}`}>
                        <input name="clientId" type="hidden" value={client.id} />
                        <input aria-label="거래처명" defaultValue={client.name} name="name" required />
                        <input aria-label="담당자" defaultValue={client.manager === "-" ? "" : client.manager} name="managerName" />
                        <input aria-label="연락처" defaultValue={client.phone === "-" ? "" : client.phone} name="phone" />
                        <input aria-label="주소" defaultValue={client.address} name="address" />
                        <input name="memo" type="hidden" value={client.memo} />
                      </form>
                    </td>
                  ) : (
                    <><td>{client.name}</td><td>{client.manager}</td><td>{client.phone}</td><td>{client.address || "-"}</td></>
                  )}
                  <td>{client.orderCount}</td><td><StatusBadge status={client.active ? "정상" : "취소"} /></td>
                  {canManage ? <td><div className="table-actions">
                    <SubmitButton className="table-action" form={`client-${client.id}`} pendingLabel="저장 중...">저장</SubmitButton>
                    <form action={toggleClientActive}><input name="clientId" type="hidden" value={client.id} /><SubmitButton className={client.active ? "table-action danger" : "table-action"} confirmMessage={`${client.name} 거래처를 ${client.active ? "비활성화" : "활성화"}하시겠습니까?`}>{client.active ? "비활성화" : "활성화"}</SubmitButton></form>
                  </div></td> : null}
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        {canManage ? <Panel title="거래처 등록" note="관리자 전용">
          <form action={createClient} className="entry-form compact-entry-form">
            <label>거래처명<input name="name" placeholder="병원 또는 기관명" required /></label>
            <label>담당자<input name="managerName" placeholder="선택 입력" /></label>
            <label>연락처<input name="phone" placeholder="선택 입력" type="tel" /></label>
            <label className="wide">주소<input name="address" placeholder="선택 입력" /></label>
            <label className="wide">메모<textarea name="memo" placeholder="거래처 관련 참고사항" /></label>
            <div className="form-actions"><SubmitButton className="primary-button" pendingLabel="등록 중...">거래처 등록</SubmitButton></div>
          </form>
        </Panel> : null}
      </div>
    </AppShell>
  );
}
