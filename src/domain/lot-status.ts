import { daysUntilDateOnly } from "../lib/date";

/** LOT 상태의 표시 순서와 판정 규칙이다. 만료·품절·임박 상태가 재고 상태보다 우선한다. */

export const LOT_STATUS_KINDS = [
  "NORMAL",
  "OUT_OF_STOCK",
  "EXPIRING",
  "EXPIRED"
] as const;

export type LotStatusKind = (typeof LOT_STATUS_KINDS)[number];
export type LotStatusLabel = "정상" | "품절" | "유통기한 임박" | "유통기한 만료";
export type LotStatusFilter = LotStatusKind | "ALL";

const lotStatusLabels = {
  NORMAL: "정상",
  OUT_OF_STOCK: "품절",
  EXPIRING: "유통기한 임박",
  EXPIRED: "유통기한 만료"
} satisfies Record<LotStatusKind, LotStatusLabel>;

export function isLotStatusKind(value: string): value is LotStatusKind {
  return (LOT_STATUS_KINDS as readonly string[]).includes(value);
}

export function isLotStatusFilter(value: string): value is LotStatusFilter {
  return value === "ALL" || isLotStatusKind(value);
}

export function lotStatusLabel(status: LotStatusKind): LotStatusLabel {
  return lotStatusLabels[status];
}

export function lotStatusKindFromSnapshot(
  lot: {
    currentQuantity: number;
    expirationDate: Date | string;
  },
  now = new Date()
): LotStatusKind {
  const days = daysUntilDateOnly(lot.expirationDate, now);
  if (lot.currentQuantity === 0) return "OUT_OF_STOCK";
  if (days < 0) return "EXPIRED";
  if (days <= 30) return "EXPIRING";
  return "NORMAL";
}

export function lotStatusFromSnapshot(
  lot: Parameters<typeof lotStatusKindFromSnapshot>[0],
  now = new Date()
): LotStatusLabel {
  return lotStatusLabel(lotStatusKindFromSnapshot(lot, now));
}
