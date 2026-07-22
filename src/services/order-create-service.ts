import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrderImageUpload } from "../domain/order-image";
import { koreaDatePrefix } from "../lib/date";
import { RetryableTransactionError, runSerializableTransaction } from "../lib/transaction";

type CreateOrderItem = {
  allergenId: string;
  quantity: number;
};

type CreateOrderInput = {
  clientId: string;
  memo: string | null;
  items: CreateOrderItem[];
  image?: OrderImageUpload;
  actorId: string;
  now?: Date;
};

export function isOrderNumberConflict(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") {
    return false;
  }

  const meta = "meta" in error && typeof error.meta === "object" && error.meta !== null
    ? error.meta as { target?: unknown }
    : null;
  const target = meta?.target;

  return Array.isArray(target)
    ? target.some((value) => String(value).includes("orderNo"))
    : String(target ?? "").includes("orderNo");
}

export async function nextOrderNo(tx: Prisma.TransactionClient, now?: Date) {
  const prefix = `ORD-${koreaDatePrefix(now ?? new Date())}-`;
  const latest = await tx.order.findFirst({
    where: {
      orderNo: {
        startsWith: prefix
      }
    },
    orderBy: {
      orderNo: "desc"
    },
    select: {
      orderNo: true
    }
  });
  const latestSequence = latest
    ? Number.parseInt(latest.orderNo.slice(prefix.length), 10)
    : 0;

  if (!Number.isSafeInteger(latestSequence) || latestSequence < 0) {
    throw new Error("ORDER_NUMBER_INVALID");
  }

  if (latestSequence >= 999) {
    throw new Error("ORDER_DAILY_LIMIT_REACHED");
  }

  return `${prefix}${String(latestSequence + 1).padStart(3, "0")}`;
}

export async function createOrderValue(db: PrismaClient, input: CreateOrderInput) {
  return runSerializableTransaction(db, async (tx) => {
    const client = await tx.client.findFirst({
      where: {
        id: input.clientId,
        isActive: true
      },
      select: {
        id: true
      }
    });

    if (!client) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    const allergenCount = await tx.allergen.count({
      where: {
        id: {
          in: input.items.map((item) => item.allergenId)
        },
        isActive: true
      }
    });

    if (allergenCount !== input.items.length) {
      throw new Error("ALLERGEN_NOT_FOUND");
    }

    const orderNo = await nextOrderNo(tx, input.now);

    try {
      const order = await tx.order.create({
        data: {
          orderNo,
          clientId: client.id,
          status: "RECEIVED",
          memo: input.memo,
          createdBy: input.actorId,
          items: {
            createMany: {
              data: input.items
            }
          },
          ...(input.image
            ? {
                image: {
                  create: input.image
                }
              }
            : {})
        }
      });

      await tx.auditLog.create({
        data: {
          action: "ORDER_CREATE",
          entityType: "ORDER",
          entityId: order.id,
          description: `${orderNo} 주문 등록 (${input.items.length}개 품목${input.image ? ", 이미지 첨부" : ""})`,
          actorId: input.actorId
        }
      });

      return order;
    } catch (error) {
      if (isOrderNumberConflict(error)) {
        throw new RetryableTransactionError();
      }

      throw error;
    }
  });
}
