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
import { ExportDownloadButton } from "../exports/export-download-button";
import { buildOrderWhere } from "@/domain/export-filters";

export const dynamic = "force-dynamic";

function orderDateError(from: string, to: string) {
  try {
    buildOrderWhere({ from, to });
    return "";
  } catch (error) {
    if (!(error instanceof Error)) return "주문일 조건이 올바르지 않습니다.";
    if (error.message === "EXPORT_FILTER_FROM_INVALID") return "시작일 형식이 올바르지 않습니다.";
    if (error.message === "EXPORT_FILTER_TO_INVALID") return "종료일 형식이 올바르지 않습니다.";
    if (error.message === "EXPORT_FILTER_DATE_RANGE_INVALID") {
      return "종료일은 시작일과 같거나 이후여야 합니다.";
    }
    return "주문일 조건이 올바르지 않습니다.";
  }
}
export default async function OrdersPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string; q?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const fromValue = params?.from?.trim() ?? "";
  const toValue = params?.to?.trim() ?? "";
  const dateError = orderDateError(fromValue, toValue);
  const from = dateError ? "" : fromValue;
  const to = dateError ? "" : toValue;
  const [user, data, flash] = await Promise.all([
    requireUser(),
    getOrderRows(parsePage(params?.page), params?.q?.trim(), from, to),
    getFlashMessage()
  ]);
  const orderRows = data.rows;
  const canWrite = can(user.role, "ORDER_WRITE");
  const canExport = can(user.role, "DATA_EXPORT");

  return (
    <AppShell
      active="/orders"
      title="주문 관리"
      description="거래처 주문을 접수하고 출고 대기 상태까지 추적합니다."
      action={canWrite ? "주문 등록" : undefined}
      actionHref={canWrite ? "/orders/new" : undefined}
    >
      <FlashMessage value={flash} />
      {dateError ? <div className="page-alert" role="alert">{dateError}</div> : null}
      <div className="table-filter-toolbar extended-filter-toolbar">
        <TableSearch
          description="검색어와 주문일을 조합해 주문 내역을 확인하세요. 날짜를 비우면 전체 기간입니다."
          filters={[
            {
              kind: "date",
              label: "시작일",
              max: toValue,
              name: "from",
              value: fromValue
            },
            {
              kind: "date",
              label: "종료일",
              min: fromValue,
              name: "to",
              value: toValue
            }
          ]}
          pathname="/orders"
          placeholder="주문번호, 거래처, 시약, 메모 검색"
          title="주문 검색·기간"
          value={params?.q}
        />
        {canExport ? (
          <ExportDownloadButton
            disabled={Boolean(dateError)}
            fallbackFileName="주문-내역.xlsx"
            label="현재 조건 엑셀"
            query={{ report: "orders", q: params?.q, from, to }}
          />
        ) : null}
      </div>
      <Panel title="주문 목록" note={`${orderSourceLabel(orderRows)} · 최근 주문 우선`}>
        <Table>
          <thead>
            <tr>
              <th>주문번호</th>
              <th>거래처</th>
              <th>주문일</th>
              <th>품목</th>
              <th>메모</th>
              <th>첨부 이미지</th>
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
                <td>
                  <ItemQuantitySummary
                    dialogSubtitle={order.orderNo}
                    items={order.itemDetails}
                    summarizeAt={3}
                  />
                </td>
                <td>{order.memo}</td>
                <td>
                  {order.image ? (
                    <span className="stacked">
                      <a
                        aria-label={`${order.orderNo} 첨부 이미지 보기`}
                        className="table-action"
                        href={`/api/orders/${encodeURIComponent(order.id)}/image`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        이미지 보기
                      </a>
                    </span>
                  ) : "-"}
                </td>
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
        <Pagination page={data.page} pathname="/orders" preserve={{ q: params?.q, from, to }} total={data.total} totalPages={data.totalPages} />
      </Panel>
    </AppShell>
  );
}
