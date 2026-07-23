import type { Prisma, PrismaClient, ReturnDisposition } from "@prisma/client";
import { cache } from "react";
import { addDateOnlyDays, koreaDateKey, koreaDatePrefix } from "../lib/date";
import { RetryableTransactionError, runSerializableTransaction } from "../lib/transaction";

export const REPLACEMENT_POLICY_ID = "default";

export const getReplacementPolicy = cache(async (db: Pick<PrismaClient, "replacementPolicy">) => {
  return db.replacementPolicy.findUniqueOrThrow({ where: { id: REPLACEMENT_POLICY_ID } });
});

async function nextReplacementNo(tx: Prisma.TransactionClient, now: Date) {
  const prefix = `REP-${koreaDatePrefix(now)}-`;
  const latest = await tx.replacement.findFirst({
    where: { replacementNo: { startsWith: prefix } },
    orderBy: { replacementNo: "desc" },
    select: { replacementNo: true }
  });
  const sequence = latest ? Number(latest.replacementNo.slice(prefix.length)) + 1 : 1;
  if (!Number.isSafeInteger(sequence) || sequence > 999) throw new Error("REPLACEMENT_DAILY_LIMIT");
  return `${prefix}${String(sequence).padStart(3, "0")}`;
}

export async function confirmReplacement(db: PrismaClient, input: {
  shipmentItemId: string;
  quantity: number;
  actorId: string;
  excludeReason?: string;
  origin?: "EXPIRY" | "PRODUCT_DEFECT";
  reason?: string;
  now?: Date;
}) {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) throw new Error("REPLACEMENT_QUANTITY_INVALID");
  const origin = input.origin ?? "EXPIRY";
  const reason = input.reason?.trim() ?? "";
  if (origin === "PRODUCT_DEFECT" && !reason) throw new Error("REPLACEMENT_REASON_REQUIRED");
  if (reason.length > 500) throw new Error("REPLACEMENT_REASON_INVALID");
  return runSerializableTransaction(db, async (tx) => {
    const item = await tx.shipmentItem.findUnique({
      where: { id: input.shipmentItemId },
      include: { shipment: true, replacement: true }
    });
    if (!item || item.shipment.status !== "SHIPPED" || item.shipment.purpose !== "ORDER") throw new Error("ORIGINAL_SHIPMENT_ITEM_NOT_FOUND");
    if (item.replacement) throw new Error("REPLACEMENT_ALREADY_EXISTS");
    if (input.quantity > item.quantity) throw new Error("REPLACEMENT_QUANTITY_EXCEEDS_SHIPMENT");
    const now = input.now ?? new Date();
    const replacementNo = await nextReplacementNo(tx, now);
    const excluded = Boolean(input.excludeReason?.trim());
    const replacement = await tx.replacement.create({ data: {
      replacementNo,
      originalShipmentItemId: item.id,
      confirmedQuantity: input.quantity,
      origin,
      reason: reason || null,
      status: excluded ? "EXCLUDED" : "CONFIRMED",
      exclusionReason: excluded ? input.excludeReason!.trim() : null,
      createdBy: input.actorId
    }});
    await tx.auditLog.create({ data: {
      action: excluded ? "REPLACEMENT_EXCLUDE" : "REPLACEMENT_CONFIRM",
      entityType: "REPLACEMENT", entityId: replacement.id,
      description: excluded
        ? `${replacementNo} 교환 제외: ${input.excludeReason!.trim()}`
        : origin === "PRODUCT_DEFECT"
          ? `${replacementNo} 제품 하자 교환 ${input.quantity}개 등록: ${reason}`
          : `${replacementNo} 교환 ${input.quantity}개 확정`,
      actorId: input.actorId
    }});
    return replacement;
  });
}

export async function registerDefectReplacement(db: PrismaClient, input: {
  shipmentItemId: string;
  quantity: number;
  reason: string;
  actorId: string;
  now?: Date;
}) {
  return confirmReplacement(db, {
    shipmentItemId: input.shipmentItemId,
    quantity: input.quantity,
    reason: input.reason,
    actorId: input.actorId,
    origin: "PRODUCT_DEFECT",
    now: input.now
  });
}

export async function completeReplacement(db: PrismaClient, input: {
  replacementId: string;
  disposition: ReturnDisposition;
  actorId: string;
  now?: Date;
}) {
  return runSerializableTransaction(db, async (tx) => {
    const replacement = await tx.replacement.findUnique({
      where: { id: input.replacementId },
      include: { originalShipmentItem: { include: { shipment: { include: { order: true } }, reagentLot: { include: { allergen: true } } } } }
    });
    if (!replacement) throw new Error("REPLACEMENT_NOT_FOUND");
    if (replacement.status !== "CONFIRMED") throw new Error("REPLACEMENT_NOT_CONFIRMED");
    const now = input.now ?? new Date();
    const todayKey = koreaDateKey(now);
    const tomorrow = addDateOnlyDays(todayKey, 1);
    const policy = await tx.replacementPolicy.findUniqueOrThrow({ where: { id: REPLACEMENT_POLICY_ID } });
    const minimumExpiration = addDateOnlyDays(todayKey, policy.minimumDeliveryShelfDays);
    const stocks = await tx.warehouseStock.findMany({
      where: {
        warehouse: "FINISHED_GOODS",
        quantity: { gt: 0 },
        reagentLot: { is: {
          allergenId: replacement.originalShipmentItem.allergenId,
          isActive: true,
          receivedDate: { lt: tomorrow },
          expirationDate: { gte: minimumExpiration }
        } }
      },
      include: { reagentLot: true },
      orderBy: [
        { reagentLot: { expirationDate: "asc" } },
        { reagentLot: { lotNo: "asc" } }
      ]
    });
    let remaining = replacement.confirmedQuantity;
    const allocations: Array<{ id: string; quantity: number }> = [];
    for (const stock of stocks) {
      if (remaining === 0) break;
      const quantity = Math.min(remaining, stock.quantity);
      allocations.push({ id: stock.reagentLotId, quantity });
      remaining -= quantity;
    }
    if (remaining > 0) throw new Error("REPLACEMENT_STOCK_INSUFFICIENT");
    for (const allocation of allocations) {
      const changed = await tx.warehouseStock.updateMany({ where: {
        reagentLotId: allocation.id,
        warehouse: "FINISHED_GOODS",
        quantity: { gte: allocation.quantity },
        reagentLot: { is: {
          isActive: true,
          receivedDate: { lt: tomorrow },
          expirationDate: { gte: minimumExpiration }
        } }
      }, data: { quantity: { decrement: allocation.quantity } } });
      if (changed.count !== 1) throw new RetryableTransactionError();
    }
    const shipment = await tx.shipment.create({ data: {
      orderId: replacement.originalShipmentItem.shipment.orderId,
      purpose: "REPLACEMENT", status: "SHIPPED", shippedBy: input.actorId,
      memo: `${replacement.replacementNo} 교환 출고`
    }});
    await tx.shipmentItem.createMany({
      data: allocations.map((allocation) => ({
        shipmentId: shipment.id,
        reagentLotId: allocation.id,
        allergenId: replacement.originalShipmentItem.allergenId,
        quantity: allocation.quantity
      }))
    });
    await tx.stockMovement.createMany({
      data: allocations.map((allocation) => ({
        reagentLotId: allocation.id,
        type: "OUT" as const,
        quantity: allocation.quantity,
        warehouse: "FINISHED_GOODS" as const,
        reason: `${replacement.replacementNo} 교환`,
        refType: "REPLACEMENT",
        refId: replacement.id,
        createdBy: input.actorId
      }))
    });
    const completed = await tx.replacement.update({ where: { id: replacement.id }, data: {
      status: "COMPLETED", returnDisposition: input.disposition,
      replacementShipmentId: shipment.id, completedBy: input.actorId, completedAt: now
    }});
    await tx.auditLog.create({ data: { action: "REPLACEMENT_COMPLETE", entityType: "REPLACEMENT", entityId: replacement.id, description: `${replacement.replacementNo} 교환품 ${replacement.confirmedQuantity}개 출고 완료`, actorId: input.actorId } });
    return completed;
  });
}
