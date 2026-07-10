export type StockAdjustmentType = "ADJUST" | "DISPOSE";
export type StockAdjustmentOperation = "ADD" | "REMOVE" | "DISPOSE";

export function signedAdjustmentQuantity(operation: StockAdjustmentOperation, value: string) {
  const quantity = Number.parseInt(value.trim(), 10);

  if (!Number.isInteger(quantity) || quantity <= 0) {
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
