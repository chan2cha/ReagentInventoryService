"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { DialogFrame } from "../dialog-frame";
import { SearchableSelect, type SearchableSelectOption } from "../searchable-select";
import { SubmitButton } from "../submit-button";
import { cancelOrder, updateOrder, updateOrderMetadata } from "./actions";
import type { OrderRow } from "./order-data";
import type { OrderFormAllergen, OrderFormClient } from "./new/order-form-data";
import { OrderImageInput } from "./new/order-image-input";

type EditRow = { rowId: number; allergenId: string; quantity: string };

export function OrderManagementDialog({
  order,
  clients,
  allergens
}: {
  order: OrderRow;
  clients: OrderFormClient[];
  allergens: OrderFormAllergen[];
}) {
  const [clientId, setClientId] = useState(order.clientId);
  const [rows, setRows] = useState<EditRow[]>(() => order.editableItems.map((item, index) => ({
    rowId: index + 1,
    allergenId: item.allergenId,
    quantity: String(item.quantity)
  })));
  const nextRowId = useRef(rows.length + 1);
  const selectedIds = useMemo(
    () => new Set(rows.map((row) => row.allergenId).filter(Boolean)),
    [rows]
  );
  const clientOptions = useMemo<SearchableSelectOption[]>(() => clients.map((client) => ({
    id: client.id,
    label: client.name,
    description: [client.region, client.deliveryDepartment, `담당 ${client.manager}`].filter(Boolean).join(" · "),
    keywords: [client.name, client.region ?? "", client.manager, client.deliveryDepartment ?? ""]
  })), [clients]);
  const allergenOptions = useMemo<SearchableSelectOption[]>(() => allergens.map((allergen) => ({
    id: allergen.id,
    label: `${allergen.code} · ${allergen.name}`,
    keywords: [allergen.code, allergen.name]
  })), [allergens]);

  return <DialogFrame
    className="order-management-dialog"
    eyebrow="ORDER MANAGEMENT"
    showPlus={false}
    subtitle={<span>{order.orderNo}</span>}
    title="주문 수정 및 삭제"
    triggerClassName="table-action secondary"
    triggerLabel="수정"
  >
    <div className="management-dialog-body">
      <form action={order.canEditFully ? updateOrder : updateOrderMetadata} className="entry-form order-management-form">
        <input name="orderId" type="hidden" value={order.id} />
        {order.canEditFully ? <>
          <SearchableSelect
          className="wide"
          label="거래처"
          name="clientId"
          onChange={setClientId}
          options={clientOptions}
          placeholder="거래처명, 지역, 담당자 검색"
          required
          value={clientId}
          />
          <div className="wide order-item-list">
          <div className="order-item-list-header">
            <strong>주문 품목</strong>
            <button
              disabled={rows.length >= allergens.length}
              onClick={() => setRows((current) => [...current, {
                rowId: nextRowId.current++, allergenId: "", quantity: ""
              }])}
              type="button"
            >품목 추가</button>
          </div>
          {rows.map((row, index) => <div className="order-item-row" key={row.rowId}>
            <SearchableSelect
              excludedIds={Array.from(selectedIds).filter((id) => id !== row.allergenId)}
              label="시약명"
              name="allergenId"
              onChange={(allergenId) => setRows((current) => current.map((item) => (
                item.rowId === row.rowId ? { ...item, allergenId } : item
              )))}
              options={allergenOptions}
              placeholder="시약 코드 또는 시약명 검색"
              required
              value={row.allergenId}
            />
            <label>주문 수량<input
              max="2147483647"
              min="1"
              name="quantity"
              onChange={(event) => setRows((current) => current.map((item) => (
                item.rowId === row.rowId ? { ...item, quantity: event.target.value } : item
              )))}
              required
              step="1"
              type="number"
              value={row.quantity}
            /></label>
            <button
              aria-label={`${index + 1}번째 품목 삭제`}
              className="row-icon-button"
              disabled={rows.length === 1}
              onClick={() => setRows((current) => current.filter((item) => item.rowId !== row.rowId))}
              type="button"
            ><Trash2 aria-hidden="true" size={16} /></button>
          </div>)}
          </div>
        </> : <p className="wide management-dialog-note">출고 완료 주문은 주문 메모와 첨부 이미지만 수정할 수 있습니다.</p>}
        <OrderImageInput
          existingImage={order.image ? {
            ...order.image,
            href: `/api/orders/${encodeURIComponent(order.id)}/image`
          } : null}
          title="주문 첨부 이미지"
        />
        <label className="wide">메모<textarea
          defaultValue={order.memo === "-" ? "" : order.memo}
          name="memo"
          placeholder="주문 메모를 입력하세요."
          rows={3}
        /></label>
        <div className="form-actions">
          <button className="secondary-button" data-dialog-close type="button">닫기</button>
          <SubmitButton className="primary-button" pendingLabel="저장 중...">수정 저장</SubmitButton>
        </div>
      </form>
      {order.canCancel ? <form action={cancelOrder} className="management-delete-form">
        <input name="orderId" type="hidden" value={order.id} />
        <label><span>주문 삭제</span><input aria-label="주문 삭제 사유" name="reason" placeholder="삭제 사유를 입력하세요." required /></label>
        <SubmitButton
          className="primary-button danger"
          confirmMessage={`${order.orderNo} 주문을 삭제하시겠습니까? 삭제 후에는 출고 대기 목록에서 제외됩니다.`}
          pendingLabel="삭제 중..."
        >삭제</SubmitButton>
      </form> : null}
    </div>
  </DialogFrame>;
}
