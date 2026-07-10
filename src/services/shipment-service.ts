import type { Prisma, PrismaClient } from "@prisma/client";

type Database = PrismaClient;

export async function processShipment(db: Database, orderId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: { include: { allergen: true } } } });
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status === "SHIPPED") throw new Error("ORDER_ALREADY_SHIPPED");
    if (order.status === "CANCELLED") throw new Error("ORDER_CANCELLED");

    const allocations: Array<{ allergenId: string; lotId: string; quantity: number }> = [];
    for (const item of order.items) {
      let remaining = item.quantity;
      const lots = await tx.reagentLot.findMany({ where: { allergenId: item.allergenId, currentQuantity: { gt: 0 }, isActive: true }, orderBy: [{ expirationDate: "asc" }, { lotNo: "asc" }] });
      for (const lot of lots) {
        if (remaining === 0) break;
        const quantity = Math.min(remaining, lot.currentQuantity);
        remaining -= quantity;
        allocations.push({ allergenId: item.allergenId, lotId: lot.id, quantity });
      }
      if (remaining > 0) throw new Error(`INSUFFICIENT_STOCK:${item.allergen.code}`);
    }

    const shipment = await tx.shipment.create({ data: { orderId, status: "SHIPPED", shippedBy: actorId, memo: "유통기한 빠른 순 자동 출고" } });
    for (const allocation of allocations) {
      await tx.reagentLot.update({ where: { id: allocation.lotId }, data: { currentQuantity: { decrement: allocation.quantity } } });
      await tx.shipmentItem.create({ data: { shipmentId: shipment.id, reagentLotId: allocation.lotId, allergenId: allocation.allergenId, quantity: allocation.quantity } });
      await tx.stockMovement.create({ data: { reagentLotId: allocation.lotId, type: "OUT", quantity: allocation.quantity, reason: order.orderNo, refType: "SHIPMENT", refId: shipment.id, createdBy: actorId } });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "SHIPPED" } });
    await tx.auditLog.create({ data: { action: "SHIPMENT_CREATE", entityType: "SHIPMENT", entityId: shipment.id, description: `${order.orderNo} 출고 처리`, actorId } });
    return shipment;
  }, { isolationLevel: "Serializable" });
}

export async function reverseShipment(db: Database, shipmentId: string, actorId: string, reason: string) {
  return db.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({ where: { id: shipmentId }, include: { items: true, order: true } });
    if (!shipment) throw new Error("SHIPMENT_NOT_FOUND");
    if (shipment.status === "CANCELLED") throw new Error("SHIPMENT_ALREADY_CANCELLED");
    for (const item of shipment.items) {
      await tx.reagentLot.update({ where: { id: item.reagentLotId }, data: { currentQuantity: { increment: item.quantity } } });
      await tx.stockMovement.create({ data: { reagentLotId: item.reagentLotId, type: "REVERSE", quantity: item.quantity, reason: `${shipment.order.orderNo} 출고 취소`, refType: "SHIPMENT_CANCEL", refId: shipment.id, createdBy: actorId } });
    }
    await tx.shipment.update({ where: { id: shipment.id }, data: { status: "CANCELLED", memo: shipment.memo ? `${shipment.memo} / 출고 취소: ${reason}` : `출고 취소: ${reason}` } });
    await tx.order.update({ where: { id: shipment.orderId }, data: { status: "READY_TO_SHIP" } });
    await tx.auditLog.create({ data: { action: "SHIPMENT_CANCEL", entityType: "SHIPMENT", entityId: shipment.id, description: `${shipment.order.orderNo} 출고 취소: ${reason}`, actorId } });
  }, { isolationLevel: "Serializable" });
}

export type TransactionClient = Prisma.TransactionClient;
