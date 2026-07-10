import { AppShell, Panel } from "../../reagent-ui";
import { OrderForm } from "./order-form";
import { getOrderFormData } from "./order-form-data";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const [{ clients, allergens }, params] = await Promise.all([
    getOrderFormData(),
    searchParams,
    requirePageRole(["ADMIN", "ORDER_MANAGER"])
  ]);
  const error = params?.error;
  const canSubmit = clients.length > 0 && allergens.length > 0;

  return (
    <AppShell
      active="/orders"
      title="주문 등록"
      description="거래처와 시약을 선택해 새 주문을 등록합니다."
    >
      <div className="form-layout">
        <Panel title="주문 정보" note="최신 정보">
          {error ? <div className="form-alert">{error}</div> : null}
          <OrderForm allergens={allergens} clients={clients} />
        </Panel>

        <Panel title="등록 기준">
          <div className="rule-list">
            <p>주문번호는 ORD-YYYYMMDD-### 형식으로 자동 생성됩니다.</p>
            <p>신규 주문은 접수 상태로 생성되고 출고 처리 화면에 표시됩니다.</p>
            <p>하나의 주문에 여러 시약과 수량을 함께 등록할 수 있습니다.</p>
            {!canSubmit ? <p>거래처와 시약 목록을 불러오지 못했습니다.</p> : null}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
import { requirePageRole } from "@/lib/auth";
