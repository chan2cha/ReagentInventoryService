"use client";

/** 주문별 출고 수량을 입력하고, 서비스가 계산한 LOT 배정 결과를 사용자에게 안내한다. */

import type { ShipmentAllocationItemRow, ShipmentOrderRow } from "./shipment-data";
import { confirmShipment } from "./actions";
import { SubmitButton } from "../submit-button";
import { DialogFrame } from "../dialog-frame";
import { useRef, useState } from "react";
import { useConfirmationDialog } from "../confirmation-dialog";

type AllocationLot = ShipmentAllocationItemRow["lots"][number];
type AllocationItem = NonNullable<ShipmentOrderRow["allocationItems"]>[number];

export function shipmentPreflightError(
  items: readonly AllocationItem[],
  allocatedByItem: Readonly<Record<string, number>>,
  shipmentMemo: string
) {
  let totalAllocatedQuantity = 0;

  for (const item of items) {
    const allocatedQuantity = allocatedByItem[item.id] ?? 0;
    if (!Number.isInteger(allocatedQuantity) || allocatedQuantity < 0) {
      return `${item.code} 시약의 출고 수량을 0 이상의 정수로 입력하세요.`;
    }
    if (allocatedQuantity > item.quantity) {
      return `${item.code} 시약은 주문 수량 ${item.quantity}개를 초과해 출고할 수 없습니다.`;
    }
    totalAllocatedQuantity += allocatedQuantity;
  }

  if (totalAllocatedQuantity === 0) {
    return "출고할 수량을 1개 이상 배정하세요.";
  }

  if (shipmentMemo.length > 500) {
    return "출고 메모는 500자 이하로 입력하세요.";
  }

  const isPartialShipment = items.some(
    (item) => (allocatedByItem[item.id] ?? 0) < item.quantity
  );
  if (isPartialShipment && !shipmentMemo.trim()) {
    return "부분 출고 시에는 출고 메모를 반드시 입력하세요.";
  }

  return null;
}

export function prioritizeShipmentLot(
  lots: AllocationLot[],
  orderQuantity: number,
  preferredLotId: string
) {
  let remaining = orderQuantity;
  const preferred = lots.find((lot) => lot.id === preferredLotId);
  const orderedLots = preferred
    ? [preferred, ...lots.filter((lot) => lot.id !== preferredLotId)]
    : lots;
  const quantities: Record<string, number> = {};

  for (const lot of orderedLots) {
    const quantity = Math.min(remaining, lot.currentQuantity);
    quantities[lot.id] = quantity;
    remaining -= quantity;
  }

  return quantities;
}

function AllocationItemEditor({
  item,
  onAllocatedQuantityChange
}: {
  item: AllocationItem;
  onAllocatedQuantityChange: (quantity: number) => void;
}) {
  const recommended = () => Object.fromEntries(
    item.lots.map((lot) => [lot.id, lot.recommendedQuantity])
  );
  const [quantities, setQuantities] = useState<Record<string, number>>(recommended);
  const allocatedQuantity = item.lots.reduce(
    (total, lot) => total + (quantities[lot.id] ?? 0),
    0
  );
  const allocationState = allocatedQuantity === item.quantity
    ? { className: "complete", label: "배정 완료" }
    : allocatedQuantity < item.quantity
      ? { className: "insufficient", label: `부족 ${item.quantity - allocatedQuantity}개` }
      : { className: "excess", label: `초과 ${allocatedQuantity - item.quantity}개` };
  const applyQuantities = (nextQuantities: Record<string, number>) => {
    setQuantities(nextQuantities);
    onAllocatedQuantityChange(item.lots.reduce(
      (total, lot) => total + (nextQuantities[lot.id] ?? 0),
      0
    ));
  };

  return <section className="allocation-item">
    <header>
      <div>
        <strong>{item.code} · {item.name}</strong>
        <span>주문 수량 <b>{item.quantity}개</b> · 출고 가능 {item.availableQuantity}개</span>
      </div>
      <div className="allocation-item-status">
        <small className={allocationState.className}>
          배정 {allocatedQuantity}개 · {allocationState.label}
        </small>
        <button
          className="allocation-reset"
          onClick={() => applyQuantities(recommended())}
          type="button"
        >
          추천안 복원
        </button>
      </div>
    </header>
    <div className="table-wrap">
      <table className="data-table allocation-table">
        <thead>
          <tr>
            <th>제조번호</th>
            <th>창고</th>
            <th>유통기한</th>
            <th>현재고</th>
            <th>기본 배정</th>
            <th>LOT 변경</th>
            <th>출고 수량</th>
          </tr>
        </thead>
        <tbody>
          {item.lots.map((lot) => <tr className={(quantities[lot.id] ?? 0) > 0 ? "allocation-selected-row" : undefined} key={lot.id}>
            <td>{lot.lotNo}<input name="lotId" type="hidden" value={lot.lotId} /><input name="warehouse" type="hidden" value={lot.warehouse} /></td>
            <td><span className="warehouse-label">{lot.warehouseName}</span></td>
            <td>{lot.expirationDate}</td>
            <td>{lot.currentQuantity}</td>
            <td>{lot.recommendedQuantity > 0 ? <span className="allocation-recommended">추천 {lot.recommendedQuantity}개</span> : "대체 가능"}</td>
            <td>
              <button
                className="allocation-priority-button"
                onClick={() => applyQuantities(prioritizeShipmentLot(item.lots, item.quantity, lot.id))}
                type="button"
              >
                이 제조번호 선택
              </button>
            </td>
            <td>
              <input
                aria-label={`${item.code} ${lot.lotNo} ${lot.warehouseName} 출고 수량`}
                max={lot.currentQuantity}
                min="0"
                name="quantity"
                onChange={(event) => {
                  const nextQuantity = Number(event.target.value);
                  applyQuantities({
                    ...quantities,
                    [lot.id]: Number.isFinite(nextQuantity)
                      ? Math.min(lot.currentQuantity, Math.max(0, nextQuantity))
                      : 0
                  });
                }}
                required
                type="number"
                value={quantities[lot.id] ?? 0}
              />
            </td>
          </tr>)}
          {item.lots.length === 0 ? <tr><td colSpan={7}>출고 가능한 LOT가 없습니다.</td></tr> : null}
        </tbody>
      </table>
    </div>
  </section>;
}

export function ShipmentAllocationDialog({ order }: { order: ShipmentOrderRow }) {
  const items = order.allocationItems ?? [];
  const { alert, confirm } = useConfirmationDialog();
  const confirmedSubmitRef = useRef(false);
  const [allocatedByItem, setAllocatedByItem] = useState<Record<string, number>>(
    () => Object.fromEntries(items.map((item) => [
      item.id,
      item.lots.reduce((total, lot) => total + lot.recommendedQuantity, 0)
    ]))
  );
  const isPartialShipment = items.some(
    (item) => (allocatedByItem[item.id] ?? 0) < item.quantity
  );
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (confirmedSubmitRef.current) {
      confirmedSubmitRef.current = false;
      return;
    }

    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const shipmentMemo = String(new FormData(form).get("shipmentMemo") ?? "");
    const error = shipmentPreflightError(items, allocatedByItem, shipmentMemo);

    if (error) {
      await alert({ message: error, tone: "danger", title: "출고 내용을 확인하세요" });
      return;
    }

    const confirmed = await confirm({
      confirmLabel: "출고 확정",
      message: "표시된 LOT와 수량으로 출고를 확정하시겠습니까? 부족분은 재주문으로 생성됩니다.",
      title: "출고를 확정할까요?"
    });
    if (confirmed) {
      confirmedSubmitRef.current = true;
      form.requestSubmit();
    }
  };

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
      <form action={confirmShipment} className="shipment-allocation-form" onSubmit={handleSubmit}>
        <input name="orderId" type="hidden" value={order.id} />
        <p className="allocation-intro">활성 창고의 재고를 유통기한이 빠른 순서로 기본 배정합니다. 다른 제조번호나 창고를 사용하려면 ‘이 제조번호 선택’을 누르거나 출고 수량을 직접 조정하세요. 출고하지 못한 부족분은 별도 재주문으로 자동 생성됩니다.</p>
        {items.map((item) => (
          <AllocationItemEditor
            item={item}
            key={item.id}
            onAllocatedQuantityChange={(quantity) => {
              setAllocatedByItem((current) => ({ ...current, [item.id]: quantity }));
            }}
          />
        ))}
        <label className="shipment-memo-field">
          <span>
            출고 메모
            <small>
              {isPartialShipment ? "부분 출고 시 필수 · 최대 500자" : "선택 입력 · 최대 500자"}
            </small>
          </span>
          <textarea
            maxLength={500}
            name="shipmentMemo"
            placeholder="LOT 변경 사유나 출고 시 참고사항을 입력하세요."
            aria-required={isPartialShipment}
            rows={3}
          />
        </label>
        <div className="allocation-actions"><button className="secondary-button" data-dialog-close type="button">취소</button><SubmitButton className="primary-button">출고 확정</SubmitButton></div>
      </form>
  </DialogFrame>;
}
