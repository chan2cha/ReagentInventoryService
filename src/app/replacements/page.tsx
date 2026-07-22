import { requirePageRole, requireUser } from "@/lib/auth";
import { getFlashMessage } from "@/lib/flash-message";
import { AppShell, Panel, Table } from "@/app/reagent-ui";
import { FlashMessage } from "@/app/flash-message";
import { SubmitButton } from "@/app/submit-button";
import { confirmProactiveReplacement, excludeProactiveReplacement, shipProactiveReplacement, updateReplacementPolicy } from "./actions";
import { getReplacementData } from "./replacement-data";
import { OperationGuide, guideIcons } from "../operation-guide";
import { ExpiryDateSummary } from "../expiry-date-summary";

export const dynamic = "force-dynamic";

const statusLabel = { CONFIRMED: "교환 확정", COMPLETED: "교환 완료", EXCLUDED: "교환 제외" } as const;
const dispositionLabel = { COLLECTED_DISPOSED: "회수 후 폐기", CLIENT_DISPOSED: "거래처 현장 폐기", NOT_COLLECTED: "미회수" } as const;

export default async function ReplacementsPage() {
  await requirePageRole(["ADMIN", "SHIPMENT_MANAGER"]);
  const [data, flash, user] = await Promise.all([getReplacementData(), getFlashMessage(), requireUser()]);
  return <AppShell active="/replacements" title="사후 관리" description="유통기한 임박 납품분을 먼저 확인하고 신규 LOT로 교환합니다.">
    <FlashMessage value={flash} />
    <Panel title="사후 관리 안내" note="현재 적용 기준">
      <OperationGuide items={[
        { title: "확인 대상 시점", description: <>원출고 LOT가 만료 <b>{data.policy.detectionDays}일 전</b>부터 확인 대상에 표시됩니다.</>, icon: guideIcons.Clock3, tone: "attention" },
        { title: "교환품 선택 기준", description: <>납품 시점에 유통기한이 <b>최소 {data.policy.minimumShelfLifeDays}일</b> 남은 LOT만 교환품으로 사용할 수 있습니다.</>, icon: guideIcons.PackageCheck, tone: "success" },
        { title: "수량 확정 전 확인", description: "거래처의 실제 잔량을 확인한 뒤 교환 수량을 확정하세요.", icon: guideIcons.ShieldCheck }
      ]} />
    </Panel>
    {user.role === "ADMIN" ? <Panel title="교환 기준 설정" note="관리자 전용">
      <form action={updateReplacementPolicy} className="policy-settings">
        <label><span>교환 통지·확인 기준일</span><span className="policy-number-input"><input aria-label="교환 통지·확인 기준일" defaultValue={data.policy.detectionDays} min={1} max={3650} name="detectionDays" required type="number" /><em>일 전</em></span></label>
        <label><span>교환품 최소 잔여 유통기한</span><span className="policy-number-input"><input aria-label="교환품 최소 잔여 유통기한" defaultValue={data.policy.minimumShelfLifeDays} min={1} max={3650} name="minimumDeliveryShelfDays" required type="number" /><em>일</em></span></label>
        <SubmitButton className="table-action" pendingLabel="저장 중...">기준 저장</SubmitButton>
      </form>
    </Panel> : null}
    <Panel title="교환 확인 대상" note={`${data.candidates.length}건`}>
      <Table><thead><tr><th>거래처</th><th>주문</th><th>시약</th><th>원 제조번호</th><th>유통기한</th><th>출고수량</th><th>처리</th></tr></thead><tbody>
        {data.candidates.map((row) => <tr key={row.id}><td>{row.clientName}</td><td>{row.orderNo}</td><td>{row.allergenCode} · {row.allergenName}</td><td>{row.lotNo}</td><td><ExpiryDateSummary date={row.expirationDate} daysRemaining={row.daysRemaining} /></td><td>{row.shippedQuantity}</td><td><div className="table-actions">
          <form action={confirmProactiveReplacement} className="inline-cancel-form"><input name="shipmentItemId" type="hidden" value={row.id}/><input aria-label="확인 잔량" defaultValue={row.shippedQuantity} max={row.shippedQuantity} min={1} name="quantity" required type="number"/><SubmitButton className="table-action" confirmMessage="확인한 거래처 잔량으로 교환을 확정하시겠습니까?">교환 확정</SubmitButton></form>
          <form action={excludeProactiveReplacement} className="inline-cancel-form"><input name="shipmentItemId" type="hidden" value={row.id}/><input aria-label="교환 제외 사유" name="reason" placeholder="제외 사유" required/><SubmitButton className="table-action danger" confirmMessage="이 품목을 교환 대상에서 제외하시겠습니까?">제외</SubmitButton></form>
        </div></td></tr>)}
        {data.candidates.length === 0 ? <tr><td colSpan={7}>현재 교환 확인 대상이 없습니다.</td></tr> : null}
      </tbody></Table>
    </Panel>
    <Panel title="교환 처리 이력" note={`${data.replacements.length}건`}>
      <Table><thead><tr><th>교환번호</th><th>거래처</th><th>시약</th><th>원 제조번호</th><th>수량</th><th>상태</th><th>교환 제조번호</th><th>처리</th></tr></thead><tbody>
        {data.replacements.map((row) => <tr key={row.id}><td>{row.replacementNo}</td><td>{row.clientName}</td><td>{row.allergenName}</td><td>{row.originalLotNo}</td><td>{row.quantity}</td><td><span className="status-badge">{statusLabel[row.status]}</span>{row.exclusionReason ? <small>{row.exclusionReason}</small> : null}</td><td>{row.replacementLots}</td><td>{row.status === "CONFIRMED" ? <form action={shipProactiveReplacement} className="inline-cancel-form"><input name="replacementId" type="hidden" value={row.id}/><select aria-label="기존품 처리 결과" name="disposition" required><option value="">처리 결과</option>{Object.entries(dispositionLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><SubmitButton className="table-action" confirmMessage="교환품을 출고하고 교환을 완료하시겠습니까?">교환 출고</SubmitButton></form> : row.disposition ? dispositionLabel[row.disposition] : "-"}</td></tr>)}
      </tbody></Table>
    </Panel>
  </AppShell>;
}
