import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { SubmitButton } from "../submit-button";
import { cancelShipment, shipOrder } from "./actions";
import { formatDate, getShipmentPageData, shipmentSourceLabel } from "./shipment-data";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { parsePage } from "@/lib/pagination"; import { Pagination } from "../pagination";
import { TableSearch } from "../table-search";

export const dynamic = "force-dynamic";

export default async function ShipmentsPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; success?: string; ordersPage?: string; historyPage?: string; ordersQ?: string; historyQ?: string }>;
}) {
  const params=await searchParams; const [user, data] = await Promise.all([requireUser(), getShipmentPageData(parsePage(params?.ordersPage),parsePage(params?.historyPage),params?.ordersQ?.trim(),params?.historyQ?.trim())]);
  const { orders, recommendedLots, shipmentHistory } = data;
  const canWrite = can(user.role, "SHIPMENT_WRITE");
  const error = params?.error;
  const success = params?.success;

  return (
    <AppShell
      active="/shipments"
      title="출고 처리"
      description="출고 대기 주문을 확인하고 유통기한이 빠른 재고부터 배정합니다."
    >
      {error ? <div className="page-alert">{error}</div> : null}
      {success ? <div className="page-alert success">{success}</div> : null}

      <div className="dashboard-grid">
        <Panel title="출고 대기 주문" note={shipmentSourceLabel(orders)}>
          <TableSearch pathname="/shipments" paramName="ordersQ" placeholder="주문번호, 거래처, 시약 검색" preserve={{ historyPage: params?.historyPage, historyQ: params?.historyQ }} value={params?.ordersQ} />
          <Table>
            <thead>
              <tr>
                <th>주문번호</th>
                <th>거래처</th>
                <th>주문일</th>
                <th>품목</th>
                <th>상태</th>
                {canWrite ? <th>처리</th> : null}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNo}</td>
                  <td>
                    <span className="stacked">
                      <strong>{order.clientName}</strong>
                      <small>{order.clientManager}</small>
                    </span>
                  </td>
                  <td>{formatDate(order.orderDate)}</td>
                  <td>{order.items}</td>
                  <td><StatusBadge status={order.status} /></td>
                  {canWrite ? <td>
                    <form action={shipOrder}>
                      <input name="orderId" type="hidden" value={order.id} />
                      <SubmitButton className="table-action" confirmMessage={`${order.orderNo} 주문을 출고 처리하시겠습니까? 유통기한이 빠른 재고부터 자동 차감됩니다.`} disabled={order.source !== "database"} pendingLabel="출고 중...">
                        출고 처리
                      </SubmitButton>
                    </form>
                  </td> : null}
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 6 : 5}>출고 대기 주문이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </Table>
          <Pagination page={data.orderMeta.page} paramName="ordersPage" pathname="/shipments" preserve={{ordersQ:params?.ordersQ,historyPage:params?.historyPage,historyQ:params?.historyQ}} total={data.orderMeta.total} totalPages={data.orderMeta.totalPages} />
        </Panel>

        <Panel title="추천 재고" note={`${shipmentSourceLabel(recommendedLots)} · 유통기한 빠른 순`}>
          <div className="split-list">
            {recommendedLots.map((lot) => (
              <div className="split-row" key={lot.id}>
                <div>
                  <strong>{lot.allergenCode}</strong>
                  <span>{lot.allergenName}</span>
                  <span>{lot.lotNo} · {formatDate(lot.expirationDate)} · {lot.currentQuantity}개</span>
                </div>
                <StatusBadge status={lot.status} />
              </div>
            ))}
            {recommendedLots.length === 0 ? (
              <div className="empty-state">출고 가능한 재고가 없습니다.</div>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="dashboard-grid lower">
        <Panel title="최근 출고 내역" note={shipmentSourceLabel(shipmentHistory)}>
          <TableSearch pathname="/shipments" paramName="historyQ" placeholder="주문번호, 거래처, 시약 검색" preserve={{ ordersPage: params?.ordersPage, ordersQ: params?.ordersQ }} value={params?.historyQ} />
          <Table>
            <thead>
              <tr>
                <th>주문번호</th>
                <th>거래처</th>
                <th>출고일</th>
                <th>품목</th>
                <th>상태</th>
                {canWrite ? <th>처리</th> : null}
              </tr>
            </thead>
            <tbody>
              {shipmentHistory.map((shipment) => (
                <tr key={shipment.id}>
                  <td>{shipment.orderNo}</td>
                  <td>{shipment.clientName}</td>
                  <td>{formatDate(shipment.shippedAt)}</td>
                  <td>{shipment.itemSummary}</td>
                  <td><StatusBadge status={shipment.status} /></td>
                  {canWrite ? <td>
                    <form action={cancelShipment} className="inline-cancel-form">
                      <input name="shipmentId" type="hidden" value={shipment.id} />
                      <input aria-label="출고 취소 사유" name="reason" placeholder="취소 사유" required />
                      <SubmitButton className="table-action danger" confirmMessage={`${shipment.orderNo} 출고를 취소하시겠습니까? 차감된 재고가 복구되고 주문은 준비중으로 돌아갑니다.`} disabled={!shipment.canCancel || shipment.source !== "database"} pendingLabel="복구 중...">
                        출고 취소
                      </SubmitButton>
                    </form>
                  </td> : null}
                </tr>
              ))}
              {shipmentHistory.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 6 : 5}>최근 출고 내역이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </Table>
          <Pagination page={data.historyMeta.page} paramName="historyPage" pathname="/shipments" preserve={{ordersPage:params?.ordersPage,ordersQ:params?.ordersQ,historyQ:params?.historyQ}} total={data.historyMeta.total} totalPages={data.historyMeta.totalPages} />
        </Panel>

        <Panel title="복구 기준">
          <div className="rule-list">
            <p>출고 취소 시 출고한 수량만큼 재고가 복구됩니다.</p>
            <p>복구 내역은 입출고 이력에 되돌림 기록으로 남습니다.</p>
            <p>취소된 출고의 주문 상태는 다시 준비중으로 전환됩니다.</p>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
