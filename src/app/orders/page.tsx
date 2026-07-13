import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { SubmitButton } from "../submit-button";
import { cancelOrder } from "./actions";
import { formatDate, getOrderRows, orderSourceLabel } from "./order-data";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { parsePage } from "@/lib/pagination"; import { Pagination } from "../pagination";
import { TableSearch } from "../table-search";
import { FlashMessage } from "../flash-message";
import { getFlashMessage } from "@/lib/flash-message";
import { ItemQuantitySummary } from "../item-quantity-summary";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams; const [user, data, flash] = await Promise.all([requireUser(), getOrderRows(parsePage(params?.page), params?.q?.trim()), getFlashMessage()]); const orderRows = data.rows;
  const canWrite = can(user.role, "ORDER_WRITE");

  return (
    <AppShell
      active="/orders"
      title="주문 관리"
      description="거래처 주문을 접수하고 출고 대기 상태까지 추적합니다."
      action={canWrite ? "주문 등록" : undefined}
      actionHref={canWrite ? "/orders/new" : undefined}
    >
      <FlashMessage value={flash} />
      <TableSearch pathname="/orders" placeholder="주문번호, 거래처, 시약, 메모 검색" value={params?.q} />
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
                <td>
                  <span className="stacked">
                    <strong>{order.clientName}</strong>
                    <small>{order.clientManager}</small>
                  </span>
                </td>
                <td>{formatDate(order.orderDate)}</td>
                <td><ItemQuantitySummary items={order.itemDetails} /></td>
                <td>{order.memo}</td>
                <td><StatusBadge status={order.status} /></td>
                {canWrite ? <td>{order.canCancel && order.source === "database" ? (
                  <form action={cancelOrder} className="inline-cancel-form">
                    <input name="orderId" type="hidden" value={order.id} />
                    <input aria-label="주문 취소 사유" name="reason" placeholder="취소 사유" required />
                    <SubmitButton className="table-action danger" confirmMessage={`${order.orderNo} 주문을 취소하시겠습니까? 취소 후에는 출고 대기 목록에서 제외됩니다.`} pendingLabel="취소 중...">
                      주문 취소
                    </SubmitButton>
                  </form>
                ) : null}</td> : null}
              </tr>
            ))}
          </tbody>
        </Table>
        <Pagination page={data.page} pathname="/orders" preserve={{ q: params?.q }} total={data.total} totalPages={data.totalPages} />
      </Panel>
    </AppShell>
  );
}
