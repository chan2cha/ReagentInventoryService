import { AppShell, Panel, StatusBadge, Table } from "../reagent-ui";
import { SubmitButton } from "../submit-button";
import { cancelShipment } from "./actions";
import { formatDate, getShipmentPageData, shipmentSourceLabel } from "./shipment-data";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/access";
import { parsePage } from "@/lib/pagination"; import { Pagination } from "../pagination";
import { TableSearch } from "../table-search";
import { FlashMessage } from "../flash-message";
import { getFlashMessage } from "@/lib/flash-message";
import { OperationGuide, guideIcons } from "../operation-guide";
import { ShipmentAllocationDialog } from "./shipment-allocation-dialog";
import { ItemQuantitySummary } from "../item-quantity-summary";
import { ProgressLink } from "../progress-link";
import type { ShipmentOrderOrigin } from "./shipment-data";

export const dynamic = "force-dynamic";

export default async function ShipmentsPage({
  searchParams
}: {
  searchParams?: Promise<{ ordersPage?: string; historyPage?: string; ordersQ?: string; historyQ?: string; ordersOrigin?: string }>;
}) {
  const params=await searchParams;
  const ordersOrigin: ShipmentOrderOrigin = params?.ordersOrigin === "SHORTAGE_REORDER" ? "SHORTAGE_REORDER" : "MANUAL";
  const orderTabHref = (origin: ShipmentOrderOrigin) => {
    const query = new URLSearchParams({ ordersOrigin: origin });

    if (params?.ordersQ) query.set("ordersQ", params.ordersQ);
    if (params?.historyPage) query.set("historyPage", params.historyPage);
    if (params?.historyQ) query.set("historyQ", params.historyQ);

    return `/shipments?${query}` as never;
  };
  const [user, data, flash] = await Promise.all([requireUser(), getShipmentPageData(parsePage(params?.ordersPage),parsePage(params?.historyPage),params?.ordersQ?.trim(),params?.historyQ?.trim(),ordersOrigin), getFlashMessage()]);
  const { orders, shipmentHistory } = data;
  const canWrite = can(user.role, "SHIPMENT_WRITE");

  return (
    <AppShell
      active="/shipments"
      title="출고 처리"
      description="출고 대기 주문을 확인하고 유통기한이 빠른 재고부터 배정합니다."
    >
      <FlashMessage value={flash} />

      <Panel title="출고·복구 안내" note="처리 전 확인 사항">
        <OperationGuide items={[
          { title: "재고 배정 기준", description: "활성 창고의 제조번호별 재고를 표시하고 유통기한이 빠른 순서로 기본 배정합니다.", icon: guideIcons.Clock3 },
          { title: "출고 취소 결과", description: "재고와 주문을 복구합니다. 단, 부족분 재주문이 출고된 경우에는 해당 출고를 먼저 취소해야 합니다.", icon: guideIcons.PackageCheck, tone: "success" },
          { title: "이력 기록", description: "복구 내역은 입출고 이력에 되돌림 기록으로 남습니다.", icon: guideIcons.ShieldCheck }
        ]} />
      </Panel>

      <div className="dashboard-grid">
        <Panel title="출고 대기 주문" note={shipmentSourceLabel(orders)}>
          <nav aria-label="출고 대기 주문 구분" className="shipment-order-tabs">
            <ProgressLink aria-current={ordersOrigin === "MANUAL" ? "page" : undefined} href={orderTabHref("MANUAL")}>신규주문</ProgressLink>
            <ProgressLink aria-current={ordersOrigin === "SHORTAGE_REORDER" ? "page" : undefined} href={orderTabHref("SHORTAGE_REORDER")}>출고예정</ProgressLink>
          </nav>
          <TableSearch pathname="/shipments" paramName="ordersQ" placeholder="주문번호, 거래처, 시약 검색" preserve={{ ordersOrigin, historyPage: params?.historyPage, historyQ: params?.historyQ }} value={params?.ordersQ} />
          <Table>
            <thead>
              <tr>
                <th>주문번호</th>
                <th>거래처</th>
                <th>주문일</th>
                <th>품목</th>
                <th>등록 구분</th>
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
                  <td><ItemQuantitySummary items={order.itemDetails} /></td>
                  <td><StatusBadge status={order.origin} /></td>
                  <td><StatusBadge status={order.status} /></td>
                  {canWrite ? <td><ShipmentAllocationDialog order={order} /></td> : null}
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 7 : 6}>출고 대기 주문이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </Table>
          <Pagination page={data.orderMeta.page} paramName="ordersPage" pathname="/shipments" preserve={{ordersOrigin,ordersQ:params?.ordersQ,historyPage:params?.historyPage,historyQ:params?.historyQ}} total={data.orderMeta.total} totalPages={data.orderMeta.totalPages} />
        </Panel>
      </div>

      <div className="dashboard-grid lower">
        <Panel title="최근 출고 내역" note={shipmentSourceLabel(shipmentHistory)}>
          <TableSearch pathname="/shipments" paramName="historyQ" placeholder="주문번호, 거래처, 시약 검색" preserve={{ ordersOrigin, ordersPage: params?.ordersPage, ordersQ: params?.ordersQ }} value={params?.historyQ} />
          <Table>
            <thead>
              <tr>
                <th>주문번호</th>
                <th>거래처</th>
                <th>출고일</th>
                <th>품목</th>
                <th>출고 메모</th>
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
                  <td><ItemQuantitySummary items={shipment.itemDetails} /></td>
                  <td>{shipment.memo}</td>
                  <td><StatusBadge status={shipment.status} /></td>
                  {canWrite ? <td>{shipment.canCancel && shipment.source === "database" ? (
                    <form action={cancelShipment} className="inline-cancel-form">
                      <input name="shipmentId" type="hidden" value={shipment.id} />
                      <input aria-label="출고 취소 사유" name="reason" placeholder="취소 사유" required />
                      <SubmitButton className="table-action danger" confirmMessage={`${shipment.orderNo} 출고를 취소하시겠습니까? 차감된 재고가 복구되고 주문은 준비중으로 돌아갑니다.`} pendingLabel="복구 중...">
                        출고 취소
                      </SubmitButton>
                    </form>
                  ) : shipment.cancellationBlockedReason ? (
                    <small className="shipment-cancellation-blocked">{shipment.cancellationBlockedReason}</small>
                  ) : null}</td> : null}
                </tr>
              ))}
              {shipmentHistory.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 7 : 6}>최근 출고 내역이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </Table>
          <Pagination page={data.historyMeta.page} paramName="historyPage" pathname="/shipments" preserve={{ordersOrigin,ordersPage:params?.ordersPage,ordersQ:params?.ordersQ,historyQ:params?.historyQ}} total={data.historyMeta.total} totalPages={data.historyMeta.totalPages} />
        </Panel>
      </div>
    </AppShell>
  );
}
