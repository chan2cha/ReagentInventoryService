import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { SubmitButton } from "../submit-button";
import { cancelOrder } from "./actions";
import { formatDate, getOrderRows, orderSourceLabel } from "./order-data";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const [user, orderRows, params] = await Promise.all([requireUser(), getOrderRows(), searchParams]);
  const canWrite = can(user.role, "ORDER_WRITE");
  const error = params?.error;
  const success = params?.success;

  return (
    <AppShell
      active="/orders"
      title="주문 관리"
      description="거래처 주문을 접수하고 출고 대기 상태까지 추적합니다."
      action={canWrite ? "주문 등록" : undefined}
      actionHref={canWrite ? "/orders/new" : undefined}
    >
      {error ? <div className="page-alert">{error}</div> : null}
      {success ? <div className="page-alert success">{success}</div> : null}
      <Panel title="주문 목록" note={`${orderSourceLabel(orderRows)} · 최근 주문 우선`}>
        <Table>
          <thead>
            <tr>
              <th>주문번호</th>
              <th>거래처</th>
              <th>주문일</th>
              <th>품목</th>
              <th>메모</th>
              <th>상태</th>
              {canWrite ? <th>처리</th> : null}
            </tr>
          </thead>
          <tbody>
            {orderRows.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNo}</td>
                {canWrite ? <td>
                  <span className="stacked">
                    <strong>{order.clientName}</strong>
                    <small>{order.clientManager}</small>
                  </span>
                </td> : null}
                <td>{formatDate(order.orderDate)}</td>
                <td>{order.items}</td>
                <td>{order.memo}</td>
                <td><StatusBadge status={order.status} /></td>
                <td>
                  <form action={cancelOrder} className="inline-cancel-form">
                    <input name="orderId" type="hidden" value={order.id} />
                    <input aria-label="주문 취소 사유" name="reason" placeholder="취소 사유" required />
                    <SubmitButton className="table-action danger" confirmMessage={`${order.orderNo} 주문을 취소하시겠습니까? 취소 후에는 출고 대기 목록에서 제외됩니다.`} disabled={!order.canCancel || order.source !== "database"} pendingLabel="취소 중...">
                      주문 취소
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
