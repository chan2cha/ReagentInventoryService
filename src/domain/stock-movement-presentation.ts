export const STOCK_MOVEMENT_KINDS = ["IN", "OUT", "ADJUST", "DISPOSE", "REVERSE"] as const;

/** DB enum을 화면과 엑셀에서 일관되게 표시하기 위한 표현 계층이다. */

export type StockMovementKind = (typeof STOCK_MOVEMENT_KINDS)[number];

export type StockMovementLabel = "입고" | "출고" | "조정" | "폐기" | "출고취소/복구";

const stockMovementLabels = {
  IN: "입고",
  OUT: "출고",
  ADJUST: "조정",
  DISPOSE: "폐기",
  REVERSE: "출고취소/복구"
} satisfies Record<StockMovementKind, StockMovementLabel>;

export function isStockMovementKind(value: string): value is StockMovementKind {
  return (STOCK_MOVEMENT_KINDS as readonly string[]).includes(value);
}

export function stockMovementTypeLabel(type: StockMovementKind): StockMovementLabel {
  return stockMovementLabels[type];
}

export function stockMovementDelta(type: StockMovementKind, rawQuantity: number) {
  if (type === "OUT") {
    return -Math.abs(rawQuantity);
  }

  if (type === "IN" || type === "REVERSE") {
    return Math.abs(rawQuantity);
  }

  return rawQuantity;
}
