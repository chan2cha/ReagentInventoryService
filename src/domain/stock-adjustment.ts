export type StockAdjustmentType = "ADJUST" | "DISPOSE";

export function parseAdjustmentQuantity(value: string) {
  const quantity = Number.parseInt(value.trim(), 10);

  if (!Number.isInteger(quantity) || quantity === 0) {
    throw new Error("ADJUSTMENT_QUANTITY_INVALID");
  }

  return quantity;
}

export function nextStockQuantity(currentQuantity: number, adjustmentQuantity: number) {
  const nextQuantity = currentQuantity + adjustmentQuantity;

  if (nextQuantity < 0) {
    throw new Error("ADJUSTMENT_STOCK_NEGATIVE");
  }

  return nextQuantity;
}
