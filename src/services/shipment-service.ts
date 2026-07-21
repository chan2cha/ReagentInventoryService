import type { PrismaClient } from "@prisma/client";
import { addDateOnlyDays, dateOnlyUtc, koreaDateKey } from "../lib/date";
import { RetryableTransactionError, runSerializableTransaction } from "../lib/transaction";

type RequestedItem = {
  allergenId: string;
  allergenCode: string;
  quantity: number;
};

type Allocation = {
  allergenId: string;
  lotId: string;
  quantity: number;
};

export type ShipmentAllocationInput = {
  lotId: string;
  quantity: number;
};

function assertShippableOrder(order: {
  status: "RECEIVED" | "READY_TO_SHIP" | "SHIPPED" | "CANCELLED";
  shipments: Array<{ id: string }>;
}) {
  if (order.status === "SHIPPED" || order.shipments.length > 0) {
    throw new Error("ORDER_ALREADY_SHIPPED");
  }

  if (order.status === "CANCELLED") {
    throw new Error("ORDER_CANCELLED");
  }
}

export async function processShipment(
  db: PrismaClient,
  orderId: string,
  actorId: string,
  now?: Date,
  selectedAllocations?: ShipmentAllocationInput[]
) {
  return runSerializableTransaction(db, async (tx) => {
    // Keep an injected date stable in tests, but refresh the production clock for
    // every serializable retry so a retry crossing Korean midnight cannot use an
    // already-expired LOT.
    const todayKey = koreaDateKey(now ?? new Date());
    const today = dateOnlyUtc(todayKey);
    const tomorrow = addDateOnlyDays(todayKey, 1);

    const order = await tx.order.findUnique({
      where: {
        id: orderId
      },
      include: {
        items: {
          include: {
            allergen: true
          }
        },
        shipments: {
          where: {
            status: "SHIPPED",
            purpose: "ORDER"
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

    assertShippableOrder(order);

    const claim = await tx.order.updateMany({
      where: {
        id: order.id,
        status: {
          in: ["RECEIVED", "READY_TO_SHIP"]
        },
        shipments: {
          none: {
            status: "SHIPPED",
            purpose: "ORDER"
          }
        }
      },
      data: {
        status: "SHIPPED"
      }
    });

    if (claim.count !== 1) {
      throw new RetryableTransactionError();
    }

    const requestedByAllergen = new Map<string, RequestedItem>();

    for (const item of order.items) {
      if (item.quantity <= 0) {
        throw new Error("ORDER_ITEM_QUANTITY_INVALID");
      }

      const current = requestedByAllergen.get(item.allergenId);
      requestedByAllergen.set(item.allergenId, {
        allergenId: item.allergenId,
        allergenCode: item.allergen.code,
        quantity: (current?.quantity ?? 0) + item.quantity
      });
    }

    if (requestedByAllergen.size === 0) {
      throw new Error("ORDER_ITEMS_EMPTY");
    }

    const allocations: Allocation[] = [];

    if (selectedAllocations) {
      const normalized = new Map<string, number>();
      for (const allocation of selectedAllocations) {
        if (!allocation.lotId || !Number.isInteger(allocation.quantity) || allocation.quantity <= 0) {
          throw new Error("INVALID_ALLOCATION");
        }
        normalized.set(allocation.lotId, (normalized.get(allocation.lotId) ?? 0) + allocation.quantity);
      }

      const selectedStocks = await tx.warehouseStock.findMany({
        where: {
          reagentLotId: { in: [...normalized.keys()] },
          warehouse: "FINISHED_GOODS",
          reagentLot: {
            is: {
              expirationDate: { gte: today },
              receivedDate: { lt: tomorrow },
              isActive: true
            }
          }
        },
        select: {
          reagentLotId: true,
          reagentLot: { select: { allergenId: true } }
        }
      });
      const lotById = new Map(selectedStocks.map((stock) => [
        stock.reagentLotId,
        stock.reagentLot
      ]));
      const allocatedByAllergen = new Map<string, number>();

      for (const [lotId, quantity] of normalized) {
        const lot = lotById.get(lotId);
        if (!lot || !requestedByAllergen.has(lot.allergenId)) {
          throw new Error("INVALID_ALLOCATION");
        }
        allocatedByAllergen.set(lot.allergenId, (allocatedByAllergen.get(lot.allergenId) ?? 0) + quantity);
        allocations.push({ allergenId: lot.allergenId, lotId, quantity });
      }

      for (const item of requestedByAllergen.values()) {
        if (allocatedByAllergen.get(item.allergenId) !== item.quantity) {
          throw new Error(`ALLOCATION_QUANTITY_MISMATCH:${item.allergenCode}`);
        }
      }
    } else {
      for (const item of requestedByAllergen.values()) {
        let remaining = item.quantity;
        const candidateStocks = await tx.warehouseStock.findMany({
          where: {
            warehouse: "FINISHED_GOODS",
            quantity: { gt: 0 },
            reagentLot: {
              is: {
                allergenId: item.allergenId,
                expirationDate: { gte: today },
                receivedDate: { lt: tomorrow },
                isActive: true
              }
            }
          },
          include: { reagentLot: true },
          orderBy: [
            { reagentLot: { expirationDate: "asc" } },
            { reagentLot: { lotNo: "asc" } }
          ]
        });

        for (const stock of candidateStocks) {
          if (remaining <= 0) break;
          const quantity = Math.min(stock.quantity, remaining);
          remaining -= quantity;
          allocations.push({
            allergenId: item.allergenId,
            lotId: stock.reagentLotId,
            quantity
          });
        }

        if (remaining > 0) throw new Error(`INSUFFICIENT_STOCK:${item.allergenCode}`);
      }
    }

    for (const allocation of allocations) {
      const deduction = await tx.warehouseStock.updateMany({
        where: {
          reagentLotId: allocation.lotId,
          warehouse: "FINISHED_GOODS",
          quantity: {
            gte: allocation.quantity
          },
          reagentLot: {
            is: {
              expirationDate: { gte: today },
              receivedDate: { lt: tomorrow },
              isActive: true
            }
          }
        },
        data: {
          quantity: {
            decrement: allocation.quantity
          }
        }
      });

      if (deduction.count !== 1) {
        throw new Error("ALLOCATION_UNAVAILABLE");
      }
    }

    const shipment = await tx.shipment.create({
      data: {
        orderId: order.id,
        status: "SHIPPED",
        shippedBy: actorId,
        memo: selectedAllocations ? "관리자 LOT 배정 출고" : "유통기한 빠른 순 자동 출고"
      }
    });

    await tx.shipmentItem.createMany({
      data: allocations.map((allocation) => ({
        shipmentId: shipment.id,
        reagentLotId: allocation.lotId,
        allergenId: allocation.allergenId,
        quantity: allocation.quantity
      }))
    });

    await tx.stockMovement.createMany({
      data: allocations.map((allocation) => ({
        reagentLotId: allocation.lotId,
        type: "OUT" as const,
        quantity: allocation.quantity,
        warehouse: "FINISHED_GOODS" as const,
        reason: order.orderNo,
        refType: "SHIPMENT",
        refId: shipment.id,
        createdBy: actorId
      }))
    });

    await tx.auditLog.create({
      data: {
        action: "SHIPMENT_CREATE",
        entityType: "SHIPMENT",
        entityId: shipment.id,
        description: `${order.orderNo} 출고 처리`,
        actorId
      }
    });

    return shipment;
  });
}

export async function reverseShipment(
  db: PrismaClient,
  shipmentId: string,
  actorId: string,
  reason: string
) {
  return runSerializableTransaction(db, async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: {
        id: shipmentId
      },
      include: {
        items: true,
        order: true
      }
    });

    if (!shipment) {
      throw new Error("SHIPMENT_NOT_FOUND");
    }

    if (shipment.purpose !== "ORDER") {
      throw new Error("SHIPMENT_NOT_REVERSIBLE");
    }

    if (shipment.status === "CANCELLED") {
      throw new Error("SHIPMENT_ALREADY_CANCELLED");
    }

    const memo = shipment.memo
      ? `${shipment.memo} / 출고 취소: ${reason}`
      : `출고 취소: ${reason}`;
    const claim = await tx.shipment.updateMany({
      where: {
        id: shipment.id,
        status: "SHIPPED",
        purpose: "ORDER"
      },
      data: {
        status: "CANCELLED",
        memo
      }
    });

    if (claim.count !== 1) {
      throw new RetryableTransactionError();
    }

    for (const item of shipment.items) {
      await tx.warehouseStock.update({
        where: {
          reagentLotId_warehouse: {
            reagentLotId: item.reagentLotId,
            warehouse: "FINISHED_GOODS"
          }
        },
        data: {
          quantity: {
            increment: item.quantity
          }
        }
      });

    }

    await tx.stockMovement.createMany({
      data: shipment.items.map((item) => ({
        reagentLotId: item.reagentLotId,
        type: "REVERSE" as const,
        quantity: item.quantity,
        warehouse: "FINISHED_GOODS" as const,
        reason: `${shipment.order.orderNo} 출고 취소: ${reason}`,
        refType: "SHIPMENT_CANCEL",
        refId: shipment.id,
        createdBy: actorId
      }))
    });

    const releasedOrder = await tx.order.updateMany({
      where: {
        id: shipment.orderId,
        status: "SHIPPED",
        shipments: {
          none: {
            status: "SHIPPED",
            purpose: "ORDER"
          }
        }
      },
      data: {
        status: "READY_TO_SHIP"
      }
    });

    if (releasedOrder.count !== 1) {
      throw new RetryableTransactionError();
    }

    await tx.auditLog.create({
      data: {
        action: "SHIPMENT_CANCEL",
        entityType: "SHIPMENT",
        entityId: shipment.id,
        description: `${shipment.order.orderNo} 출고 취소: ${reason}`,
        actorId
      }
    });

    return {
      id: shipment.id,
      orderId: shipment.orderId
    };
  });
}
