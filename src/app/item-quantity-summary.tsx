"use client";

import { DialogFrame } from "./dialog-frame";

export type ItemQuantity = {
  code: string;
  quantity: number;
};

type ItemQuantitySummaryProps = {
  items: ItemQuantity[];
  summarizeAt?: number;
  dialogSubtitle?: string;
};

export function ItemQuantitySummary({
  items,
  summarizeAt,
  dialogSubtitle
}: ItemQuantitySummaryProps) {
  const shouldSummarize = summarizeAt !== undefined && items.length >= summarizeAt;

  if (shouldSummarize) {
    const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);

    return <div className="item-quantity-condensed">
      <span className="item-quantity-overview">
        <strong>품목 {items.length}종</strong>
        <b>총 {totalQuantity}개</b>
      </span>
      <DialogFrame
        className="item-quantity-dialog"
        eyebrow="ORDER ITEMS"
        showPlus={false}
        subtitle={dialogSubtitle ? <span>{dialogSubtitle}</span> : undefined}
        title="주문 품목 상세"
        triggerClassName="item-quantity-more"
        triggerLabel="더보기"
      >
        <div className="item-quantity-dialog-body">
          <p>주문에 포함된 품목과 수량입니다.</p>
          <ul>
            {items.map((item, index) => <li key={`${item.code}-${index}`}>
              <strong>{item.code}</strong>
              <span>{item.quantity}개</span>
            </li>)}
          </ul>
          <div className="item-quantity-dialog-total">
            <span>총 {items.length}종</span>
            <strong>{totalQuantity}개</strong>
          </div>
        </div>
      </DialogFrame>
    </div>;
  }

  return <div className="item-quantity-summary">
    {items.map((item, index) => <span key={`${item.code}-${index}`}><strong>{item.code}</strong><b>{item.quantity}개</b></span>)}
  </div>;
}
