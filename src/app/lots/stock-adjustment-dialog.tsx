"use client";

import { Minus, PackageMinus, PackagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { adjustLotStock } from "./actions";
import { SubmitButton } from "../submit-button";

type Operation = "ADD" | "REMOVE" | "DISPOSE";

const operationDetails = {
  ADD: { label: "수량 추가", icon: PackagePlus, button: "추가", reason: "실사 결과 증가" },
  REMOVE: { label: "수량 차감", icon: Minus, button: "차감", reason: "실사 결과 감소" },
  DISPOSE: { label: "폐기", icon: PackageMinus, button: "폐기", reason: "유효기간 만료" }
} satisfies Record<Operation, { label: string; icon: typeof PackagePlus; button: string; reason: string }>;

export function StockAdjustmentDialog({
  lotId,
  allergenName,
  allergenCode,
  lotNo,
  currentQuantity,
  minStock,
  expirationDate,
  disabled
}: {
  lotId: string;
  allergenName: string;
  allergenCode: string;
  lotNo: string;
  currentQuantity: number;
  minStock: number | null;
  expirationDate: string;
  disabled: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [operation, setOperation] = useState<Operation>("REMOVE");
  const [quantity, setQuantity] = useState(1);
  const detail = operationDetails[operation];
  const signedQuantity = operation === "ADD" ? quantity : -quantity;
  const nextQuantity = currentQuantity + signedQuantity;
  const exceedsStock = nextQuantity < 0;
  const belowMinimum = !exceedsStock && minStock !== null && minStock > 0 && nextQuantity < minStock;
  const confirmMessage = `${allergenName} ${lotNo} 재고를 ${quantity}개 ${detail.button}하시겠습니까? 변경 후 수량은 ${nextQuantity}개입니다.`;

  return <>
    <button className="table-action" disabled={disabled} onClick={() => dialogRef.current?.showModal()} type="button">재고 조정</button>
    <dialog className="registration-dialog stock-adjustment-dialog" onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }} ref={dialogRef}>
      <header>
        <div><p className="eyebrow">STOCK ADJUSTMENT</p><h2>재고 조정</h2></div>
        <button aria-label="닫기" className="dialog-close" onClick={() => dialogRef.current?.close()} type="button"><X size={19} /></button>
      </header>
      <form action={adjustLotStock} className="stock-adjustment-form">
        <input name="lotId" type="hidden" value={lotId} />
        <section className="stock-adjustment-summary">
          <div><strong>{allergenName}</strong><span>{allergenCode}</span></div>
          <dl><div><dt>제조번호</dt><dd>{lotNo}</dd></div><div><dt>유효기간</dt><dd>{expirationDate}</dd></div><div><dt>현재 수량</dt><dd>{currentQuantity}개</dd></div></dl>
        </section>

        <fieldset className="operation-options">
          <legend>처리 유형</legend>
          {(Object.keys(operationDetails) as Operation[]).map((value) => {
            const item = operationDetails[value];
            const Icon = item.icon;
            return <label key={value}><input checked={operation === value} name="operation" onChange={() => setOperation(value)} type="radio" value={value} /><span><Icon size={18} /><strong>{item.label}</strong></span></label>;
          })}
        </fieldset>

        <label className="stock-adjustment-field">변경 수량<div><input min={1} name="quantity" onChange={(event) => setQuantity(Math.max(0, Number(event.target.value)))} required step={1} type="number" value={quantity || ""} /><span>개</span></div></label>
        <label className="stock-adjustment-field">사유<input defaultValue={detail.reason} key={operation} list={`reason-${operation}`} name="reason" placeholder="처리 사유를 입력하세요" required /></label>
        <datalist id="reason-ADD"><option value="실사 결과 증가" /><option value="입고 누락 보정" /><option value="반품 재입고" /></datalist>
        <datalist id="reason-REMOVE"><option value="실사 결과 감소" /><option value="파손" /><option value="분실" /></datalist>
        <datalist id="reason-DISPOSE"><option value="유효기간 만료" /><option value="품질 이상" /><option value="보관 상태 불량" /></datalist>

        <section className={`stock-adjustment-preview${exceedsStock ? " danger" : belowMinimum ? " warning" : ""}`}>
          <span>변경 후 수량</span><strong>{currentQuantity}개 → {nextQuantity}개</strong>
          {exceedsStock ? <p>현재 수량보다 많이 차감할 수 없습니다.</p> : null}
          {belowMinimum ? <p>변경 후 안전 수량 {minStock}개 미만이 됩니다.</p> : null}
        </section>

        <div className="stock-adjustment-actions"><button className="secondary-button" onClick={() => dialogRef.current?.close()} type="button">취소</button><SubmitButton className={operation === "DISPOSE" ? "primary-button danger" : "primary-button"} confirmMessage={confirmMessage} disabled={exceedsStock || quantity < 1} pendingLabel="처리 중...">{quantity || 0}개 {detail.button}</SubmitButton></div>
      </form>
    </dialog>
  </>;
}
