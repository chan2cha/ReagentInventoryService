"use client";

import { DialogFrame } from "../dialog-frame";
import { ItemQuantitySummary } from "../item-quantity-summary";
import { SubmitButton } from "../submit-button";
import { cancelShipment, updateShipment } from "./actions";
import type { ShipmentHistoryRow } from "./shipment-data";
import { OrderImageInput } from "../orders/new/order-image-input";

export function ShipmentManagementDialog({ shipment }: { shipment: ShipmentHistoryRow }) {
  return <DialogFrame
    className="shipment-management-dialog"
    eyebrow="SHIPMENT MANAGEMENT"
    showPlus={false}
    subtitle={<span>{shipment.orderNo} · {shipment.clientName}</span>}
    title="출고 수정 및 삭제"
    triggerClassName="table-action secondary"
    triggerLabel="수정"
  >
    <div className="management-dialog-body">
      <form action={updateShipment} className="entry-form compact-entry-form">
        <input name="shipmentId" type="hidden" value={shipment.id} />
        <div className="management-readonly-field">
          <strong>출고 품목</strong>
          <ItemQuantitySummary items={shipment.itemDetails} />
          <small>재고 이력과 연결된 품목·수량은 수정할 수 없습니다.</small>
        </div>
        <OrderImageInput
          existingImage={shipment.orderImage ? {
            ...shipment.orderImage,
            href: `/api/orders/${encodeURIComponent(shipment.orderId)}/image`
          } : null}
          title="주문 첨부 이미지"
        />
        <label><span>출고 메모</span><textarea defaultValue={shipment.editableMemo} maxLength={500} name="memo" rows={4} /></label>
        <div className="form-actions">
          <button className="secondary-button" data-dialog-close type="button">닫기</button>
          <SubmitButton className="primary-button" pendingLabel="저장 중...">수정 저장</SubmitButton>
        </div>
      </form>
      {shipment.canCancel ? <form action={cancelShipment} className="management-delete-form">
        <input name="shipmentId" type="hidden" value={shipment.id} />
        <label><span>출고 삭제</span><input aria-label="출고 삭제 사유" name="reason" placeholder="삭제 사유를 입력하세요." required /></label>
        <SubmitButton
          className="primary-button danger"
          confirmMessage={`${shipment.orderNo} 출고를 삭제하시겠습니까? 차감된 재고가 복구되고 주문은 준비중으로 돌아갑니다.`}
          pendingLabel="복구 중..."
        >삭제</SubmitButton>
      </form> : shipment.cancellationBlockedReason ? (
        <p className="management-delete-blocked">{shipment.cancellationBlockedReason}</p>
      ) : null}
    </div>
  </DialogFrame>;
}
