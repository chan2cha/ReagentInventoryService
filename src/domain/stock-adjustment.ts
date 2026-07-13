export type StockAdjustmentType = "ADJUST" | "DISPOSE";
export type StockAdjustmentOperation = "ADD" | "REMOVE" | "DISPOSE";

/** 화면의 조작 종류를 재고 원장에 저장할 부호 있는 수량으로 변환한다. */
export function signedAdjustmentQuantity(operation: StockAdjustmentOperation, value: string) {
  const normalized = value.trim();
  const quantity = Number(normalized);

  if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("ADJUSTMENT_QUANTITY_INVALID");
  }

  return operation === "ADD" ? quantity : -quantity;
}

export function nextStockQuantity(currentQuantity: number, adjustmentQuantity: number) {
  const nextQuantity = currentQuantity + adjustmentQuantity;

  if (nextQuantity < 0) {
    throw new Error("ADJUSTMENT_STOCK_NEGATIVE");
  }

  return nextQuantity;
}
