import type { Prisma } from "@prisma/client";

/** 출고 대기 건수와 출고 화면이 공유하는, 아직 처리 가능한 주문 상태 조건이다. */

export const PENDING_SHIPMENT_ORDER_STATUSES = ["RECEIVED", "READY_TO_SHIP"] as const;

export function pendingShipmentOrderWhere(): Prisma.OrderWhereInput {
  return {
    status: {
      in: [...PENDING_SHIPMENT_ORDER_STATUSES]
    }
  };
}
