import type { Prisma, PrismaClient, ReturnDisposition } from "@prisma/client";
import { addDateOnlyDays, koreaDateKey, koreaDatePrefix } from "../lib/date";
import { RetryableTransactionError, runSerializableTransaction } from "../lib/transaction";

export const REPLACEMENT_POLICY_ID = "default";

export async function getReplacementPolicy(db: Pick<PrismaClient, "replacementPolicy">) {
  return db.replacementPolicy.findUniqueOrThrow({ where: { id: REPLACEMENT_POLICY_ID } });
}

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
  now?: Date;
}) {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) throw new Error("REPLACEMENT_QUANTITY_INVALID");
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
      status: excluded ? "EXCLUDED" : "CONFIRMED",
      exclusionReason: excluded ? input.excludeReason!.trim() : null,
      createdBy: input.actorId
    }});
    await tx.auditLog.create({ data: {
      action: excluded ? "REPLACEMENT_EXCLUDE" : "REPLACEMENT_CONFIRM",
      entityType: "REPLACEMENT", entityId: replacement.id,
      description: excluded ? `${replacementNo} 교환 제외: ${input.excludeReason!.trim()}` : `${replacementNo} 선제 교환 ${input.quantity}개 확정`,
      actorId: input.actorId
    }});
    return replacement;
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
    const lots = await tx.reagentLot.findMany({ where: {
      allergenId: replacement.originalShipmentItem.allergenId,
      currentQuantity: { gt: 0 }, isActive: true,
      receivedDate: { lt: tomorrow }, expirationDate: { gte: minimumExpiration }
    }, orderBy: [{ expirationDate: "asc" }, { lotNo: "asc" }] });
    let remaining = replacement.confirmedQuantity;
    const allocations: Array<{ id: string; quantity: number }> = [];
    for (const lot of lots) {
      if (remaining === 0) break;
      const quantity = Math.min(remaining, lot.currentQuantity);
      allocations.push({ id: lot.id, quantity });
      remaining -= quantity;
    }
    if (remaining > 0) throw new Error("REPLACEMENT_STOCK_INSUFFICIENT");
    for (const allocation of allocations) {
      const changed = await tx.reagentLot.updateMany({ where: {
        id: allocation.id, currentQuantity: { gte: allocation.quantity }, isActive: true,
        receivedDate: { lt: tomorrow }, expirationDate: { gte: minimumExpiration }
      }, data: { currentQuantity: { decrement: allocation.quantity } } });
      if (changed.count !== 1) throw new RetryableTransactionError();
    }
    const shipment = await tx.shipment.create({ data: {
      orderId: replacement.originalShipmentItem.shipment.orderId,
      purpose: "REPLACEMENT", status: "SHIPPED", shippedBy: input.actorId,
      memo: `${replacement.replacementNo} 선제 교환 출고`
    }});
    for (const allocation of allocations) {
      await tx.shipmentItem.create({ data: { shipmentId: shipment.id, reagentLotId: allocation.id, allergenId: replacement.originalShipmentItem.allergenId, quantity: allocation.quantity } });
      await tx.stockMovement.create({ data: { reagentLotId: allocation.id, type: "OUT", quantity: allocation.quantity, reason: `${replacement.replacementNo} 선제 교환`, refType: "REPLACEMENT", refId: replacement.id, createdBy: input.actorId } });
    }
    const completed = await tx.replacement.update({ where: { id: replacement.id }, data: {
      status: "COMPLETED", returnDisposition: input.disposition,
      replacementShipmentId: shipment.id, completedBy: input.actorId, completedAt: now
    }});
    await tx.auditLog.create({ data: { action: "REPLACEMENT_COMPLETE", entityType: "REPLACEMENT", entityId: replacement.id, description: `${replacement.replacementNo} 교환품 ${replacement.confirmedQuantity}개 출고 완료`, actorId: input.actorId } });
    return completed;
  });
}
