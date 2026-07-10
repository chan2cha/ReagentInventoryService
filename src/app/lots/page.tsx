import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { SubmitButton } from "../submit-button";
import { adjustLotStock } from "./actions";
import { formatDate, getLotRows, lotSourceLabel } from "./lot-data";

export const dynamic = "force-dynamic";

export default async function LotsPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const [user, lotRows, params] = await Promise.all([requireUser(), getLotRows(), searchParams]);
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
                {canWrite ? <td>
                  <span className="stacked">
                    <strong>{lot.allergenName}</strong>
                    <small>{lot.allergenCode}</small>
                  </span>
                </td> : null}
                <td>{lot.lotNo}</td>
                <td>{formatDate(lot.receivedDate)}</td>
                <td>{formatDate(lot.expirationDate)}</td>
                <td>{lot.currentQuantity}</td>
                <td>{lot.initialQuantity}</td>
                <td>{lot.minStock ?? "-"}</td>
                <td><StatusBadge status={lot.status} /></td>
                <td>
                  <form action={adjustLotStock} className="inline-adjust-form">
                    <input name="lotId" type="hidden" value={lot.id} />
                    <select disabled={lot.source !== "database"} name="type" title="조정 유형">
                      <option value="ADJUST">조정</option>
                      <option value="DISPOSE">폐기</option>
                    </select>
                    <input disabled={lot.source !== "database"} name="quantity" placeholder="+5 / -2" required />
                    <input disabled={lot.source !== "database"} name="reason" placeholder="사유" required />
                    <SubmitButton className="table-action" confirmMessage={`${lot.allergenName} ${lot.lotNo}의 재고 수량을 변경하시겠습니까? 변경 내역은 입출고 이력에 기록됩니다.`} disabled={lot.source !== "database"} pendingLabel="저장 중...">
                      저장
                    </SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </AppShell>
  );
}
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
