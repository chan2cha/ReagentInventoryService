import type { PrismaClient } from "@prisma/client";
import { RetryableTransactionError, runSerializableTransaction } from "../lib/transaction";

export async function cancelPendingOrder(
  db: PrismaClient,
  orderId: string,
  actorId: string,
  reason: string
) {
  return runSerializableTransaction(db, async (tx) => {
    const order = await tx.order.findUnique({
      where: {
        id: orderId
      },
      include: {
        shipments: {
          where: {
            status: "SHIPPED"
          },
          select: {
            id: true
          }
        }
      }
    });

    if (!order) {
      throw new Error("ORDER_NOT_FOUND");
    }

    if (order.status === "CANCELLED") {
      throw new Error("ORDER_ALREADY_CANCELLED");
    }

    if (order.status === "SHIPPED" || order.shipments.length > 0) {
      throw new Error("ORDER_ALREADY_SHIPPED");
    }

    const claim = await tx.order.updateMany({
      where: {
        id: order.id,
        status: {
          in: ["RECEIVED", "READY_TO_SHIP"]
        },
        shipments: {
          none: {
            status: "SHIPPED"
          }
        }
      },
      data: {
        status: "CANCELLED"
      }
    });

    if (claim.count !== 1) {
      throw new RetryableTransactionError();
    }

    await tx.auditLog.create({
      data: {
        action: "ORDER_CANCEL",
        entityType: "ORDER",
        entityId: order.id,
        description: `${order.orderNo} 취소: ${reason}`,
        actorId
      }
    });

    return {
      id: order.id,
      status: "CANCELLED" as const
    };
  });
}
