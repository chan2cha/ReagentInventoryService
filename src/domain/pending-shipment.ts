import type { Prisma } from "@prisma/client";

export const PENDING_SHIPMENT_ORDER_STATUSES = ["RECEIVED", "READY_TO_SHIP"] as const;

export function pendingShipmentOrderWhere(): Prisma.OrderWhereInput {
  return {
    status: {
      in: [...PENDING_SHIPMENT_ORDER_STATUSES]
    }
  };
}
