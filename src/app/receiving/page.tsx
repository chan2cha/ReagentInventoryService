import { AppShell, Panel } from "../reagent-ui";
import { createReceivingLot } from "./actions";
import { getReceivingAllergens, receivingSourceLabel } from "./receiving-data";
import { koreaDateKey } from "@/lib/date";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReceivingPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const [, allergens, params] = await Promise.all([
    requirePageRole(["ADMIN", "SHIPMENT_MANAGER"]),
    getReceivingAllergens(),
    searchParams
  ]);
  const error = params?.error;
  const canSubmit = allergens.some((allergen) => allergen.source === "database");

  return (
    <AppShell
      active="/receiving"
      title="입고 등록"
      description="새로 들어온 시약의 제조번호와 수량을 등록합니다."
    >
      <div className="form-layout">
        <Panel title="입고 정보" note={receivingSourceLabel(allergens)}>
          {error ? <div className="form-alert">{error}</div> : null}
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
              <button className="primary-button" disabled={!canSubmit} type="submit">
                입고 저장
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="등록 기준">
          <div className="rule-list">
            <p>동일 시약, 제조번호, 유통기한 조합은 중복 등록하지 않습니다.</p>
            <p>입고 수량은 1개 이상이어야 합니다.</p>
            <p>저장하면 재고와 입고 이력이 함께 기록됩니다.</p>
            {!canSubmit ? <p>시약 목록을 불러오지 못했습니다. 연결 상태를 확인하세요.</p> : null}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
