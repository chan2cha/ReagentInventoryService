import { AppShell, Panel } from "../reagent-ui";
import { SubmitButton } from "../submit-button";
import { createReceivingLot } from "./actions";
import { getReceivingAllergens, receivingSourceLabel } from "./receiving-data";
import { koreaDateKey } from "@/lib/date";
import { requirePageRole } from "@/lib/auth";
import { FlashMessage } from "@/app/flash-message";
import { getFlashMessage } from "@/lib/flash-message";
import { OperationGuide, guideIcons } from "../operation-guide";

export const dynamic = "force-dynamic";

export default async function ReceivingPage() {
  const [, allergens, flash] = await Promise.all([
    requirePageRole(["ADMIN", "SHIPMENT_MANAGER"]),
    getReceivingAllergens(),
    getFlashMessage()
  ]);
  const canSubmit = allergens.some((allergen) => allergen.source === "database");

  return (
    <AppShell
      active="/receiving"
      title="입고 등록"
      description="새로 들어온 시약의 제조번호와 수량을 등록합니다."
    >
      <FlashMessage value={flash} />
      <Panel title="입고 안내" note="저장 전 확인 사항">
        <OperationGuide items={[
          { title: "중복 등록 방지", description: "동일 시약·제조번호·유통기한 조합은 한 번만 등록할 수 있습니다.", icon: guideIcons.ShieldCheck },
          { title: "수량 입력 기준", description: "입고 수량은 1개 이상으로 입력하세요.", icon: guideIcons.PackageCheck },
          { title: "저장 결과", description: "저장 즉시 현재 재고와 입고 이력에 함께 반영됩니다.", tone: "success" },
          ...(!canSubmit ? [{ title: "목록을 불러올 수 없음", description: "시약 목록 연결 상태를 확인한 후 다시 시도하세요.", tone: "attention" as const }] : [])
        ]} />
      </Panel>
      <div className="form-layout">
        <Panel title="입고 정보" note={receivingSourceLabel(allergens)}>
          <form action={createReceivingLot} className="entry-form">
            <label>
              시약명
              <select disabled={!canSubmit} name="allergenId" required>
                <option value="">시약을 선택하세요</option>
                {allergens.map((allergen) => (
                  <option key={allergen.id} value={allergen.id}>
                    {allergen.code} · {allergen.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              제조번호
              <input name="lotNo" placeholder="예: 2607-HDM1-A" required />
            </label>
            <label>
              입고 수량
              <input min="1" name="quantity" placeholder="0" required type="number" />
            </label>
            <label>
              입고일
              <input defaultValue={koreaDateKey()} name="receivedDate" required type="date" />
            </label>
            <label>
              유통기한
              <input name="expirationDate" required type="date" />
            </label>
            <label className="wide">
              메모
              <textarea name="memo" placeholder="검수 메모를 입력하세요" rows={4} />
            </label>
            <div className="form-actions">
              <SubmitButton className="primary-button" disabled={!canSubmit} pendingLabel="저장 중...">
                입고 저장
              </SubmitButton>
            </div>
          </form>
        </Panel>

      </div>
    </AppShell>
  );
}
