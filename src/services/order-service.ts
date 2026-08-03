import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrderImageUpload } from "../domain/order-image";
import { RetryableTransactionError, runSerializableTransaction } from "../lib/transaction";

export type UpdatePendingOrderInput = {
  clientId: string;
  memo: string | null;
  items: Array<{ allergenId: string; quantity: number }>;
  image?: OrderImageUpload | null;
};

type UpdateOrderMetadataInput = {
  memo: string | null;
  image?: OrderImageUpload | null;
};

export async function applyOrderImageMutation(
  tx: Prisma.TransactionClient,
  order: { id: string; orderNo: string },
  actorId: string,
  image: OrderImageUpload | null | undefined
) {
  if (image === undefined) return;
  let hadExistingImage = false;

  if (image === null) {
    const removed = await tx.orderImage.deleteMany({ where: { orderId: order.id } });
    if (removed.count === 0) return;
  } else {
    const existing = await tx.orderImage.findUnique({
      where: { orderId: order.id },
      select: { id: true }
    });
    hadExistingImage = Boolean(existing);
    await tx.orderImage.upsert({
      where: { orderId: order.id },
      create: { ...image, orderId: order.id },
      update: image
    });
  }

  await tx.auditLog.create({
    data: {
      action: image === null
        ? "ORDER_IMAGE_DELETE"
        : hadExistingImage ? "ORDER_IMAGE_REPLACE" : "ORDER_IMAGE_CREATE",
      entityType: "ORDER",
      entityId: order.id,
      description: image === null
        ? `${order.orderNo} 주문 첨부 이미지 삭제`
        : `${order.orderNo} 주문 첨부 이미지 등록·교체: ${image.fileName}`,
      actorId
    }
  });
}

export async function updatePendingOrder(
  db: PrismaClient,
  orderId: string,
  actorId: string,
  input: UpdatePendingOrderInput
) {
  return runSerializableTransaction(db, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        shipments: {
          where: { status: "SHIPPED" },
          select: { id: true }
        }
      }
    });

    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status === "CANCELLED") throw new Error("ORDER_ALREADY_CANCELLED");
    if (order.status === "SHIPPED" || order.shipments.length > 0) {
      throw new Error("ORDER_ALREADY_SHIPPED");
    }

    const [client, allergens] = await Promise.all([
      tx.client.findFirst({
        where: { id: input.clientId, isActive: true },
        select: { id: true }
      }),
      tx.allergen.findMany({
        where: {
          id: { in: input.items.map((item) => item.allergenId) },
          isActive: true
        },
        select: { id: true }
      })
    ]);

    if (!client) throw new Error("CLIENT_NOT_FOUND");
    if (allergens.length !== input.items.length) throw new Error("ALLERGEN_NOT_FOUND");

    const claim = await tx.order.updateMany({
      where: {
        id: order.id,
        status: { in: ["RECEIVED", "READY_TO_SHIP"] },
        shipments: { none: { status: "SHIPPED" } }
      },
      data: { clientId: input.clientId, memo: input.memo }
    });

    if (claim.count !== 1) throw new RetryableTransactionError();

    await tx.orderItem.deleteMany({ where: { orderId: order.id } });
    await tx.orderItem.createMany({
      data: input.items.map((item) => ({ ...item, orderId: order.id }))
    });
    await applyOrderImageMutation(tx, order, actorId, input.image);
    await tx.auditLog.create({
      data: {
        action: "ORDER_UPDATE",
        entityType: "ORDER",
        entityId: order.id,
        description: `${order.orderNo} 주문 정보 수정 (${input.items.length}개 품목)`,
        actorId
      }
    });

    return { id: order.id };
  });
}

export async function updateShippedOrderMetadata(
  db: PrismaClient,
  orderId: string,
  actorId: string,
  input: UpdateOrderMetadataInput
) {
  return runSerializableTransaction(db, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNo: true, status: true }
    });

    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status === "CANCELLED") throw new Error("ORDER_ALREADY_CANCELLED");
    if (order.status !== "SHIPPED") throw new Error("ORDER_NOT_SHIPPED");

    const claim = await tx.order.updateMany({
      where: { id: order.id, status: "SHIPPED" },
      data: { memo: input.memo }
    });
    if (claim.count !== 1) throw new RetryableTransactionError();

    await applyOrderImageMutation(tx, order, actorId, input.image);
    await tx.auditLog.create({
      data: {
        action: "ORDER_METADATA_UPDATE",
        entityType: "ORDER",
        entityId: order.id,
        description: `${order.orderNo} 출고 완료 주문 메모·첨부 정보 수정`,
        actorId
      }
    });

    return { id: order.id };
  });
}

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
