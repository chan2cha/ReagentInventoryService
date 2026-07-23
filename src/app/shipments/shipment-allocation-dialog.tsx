"use client";

/** 주문별 출고 수량을 입력하고, 서비스가 계산한 LOT 배정 결과를 사용자에게 안내한다. */

import type { ShipmentOrderRow } from "./shipment-data";
import { confirmShipment } from "./actions";
import { SubmitButton } from "../submit-button";
import { DialogFrame } from "../dialog-frame";

export function ShipmentAllocationDialog({ order }: { order: ShipmentOrderRow }) {
  const items = order.allocationItems ?? [];

  return <DialogFrame
    className="shipment-allocation-dialog"
    eyebrow="SHIPMENT ALLOCATION"
    subtitle={<span>{order.orderNo} · {order.clientName}</span>}
    showPlus={false}
    title="출고 LOT 배정"
    triggerClassName="table-action"
    triggerDisabled={order.source !== "database" || items.length === 0}
    triggerLabel="출고 진행"
  >
      <form action={confirmShipment} className="shipment-allocation-form">
        <input name="orderId" type="hidden" value={order.id} />
        <p className="allocation-intro">유통기한이 빠른 LOT부터 수량을 제안합니다. 실제 출고할 LOT와 수량을 확인·수정한 뒤 확정하세요. 출고하지 못한 부족분은 별도 재주문으로 자동 생성됩니다.</p>
        {items.map((item) => <section className="allocation-item" key={item.id}>
          <header><div><strong>{item.code} · {item.name}</strong><span>주문 수량 <b>{item.quantity}개</b></span></div><small className={item.availableQuantity < item.quantity ? "insufficient" : ""}>출고 가능 {item.availableQuantity}개</small></header>
          <div className="table-wrap"><table className="data-table allocation-table"><thead><tr><th>제조번호</th><th>유통기한</th><th>현재고</th><th>추천</th><th>출고 수량</th></tr></thead><tbody>
            {item.lots.map((lot) => <tr key={lot.id}><td>{lot.lotNo}<input name="lotId" type="hidden" value={lot.id} /></td><td>{lot.expirationDate}</td><td>{lot.currentQuantity}</td><td>{lot.recommendedQuantity > 0 ? "추천 배정" : "대체 가능"}</td><td><input aria-label={`${item.code} ${lot.lotNo} 출고 수량`} defaultValue={lot.recommendedQuantity} max={lot.currentQuantity} min="0" name="quantity" required type="number" /></td></tr>)}
            {item.lots.length === 0 ? <tr><td colSpan={5}>출고 가능한 LOT가 없습니다.</td></tr> : null}
          </tbody></table></div>
        </section>)}
        <div className="allocation-actions"><button className="secondary-button" data-dialog-close type="button">취소</button><SubmitButton className="primary-button" confirmMessage="표시된 LOT와 수량으로 출고를 확정하시겠습니까? 부족분은 재주문으로 생성됩니다.">출고 확정</SubmitButton></div>
      </form>
  </DialogFrame>;
}
