import type { PrismaClient } from "@prisma/client";
import { addDateOnlyDays, dateOnlyUtc, koreaDateKey } from "../lib/date";
import { RetryableTransactionError, runSerializableTransaction } from "../lib/transaction";
import { isOrderNumberConflict, nextOrderNo } from "./order-create-service";

type RequestedItem = {
  allergenId: string;
  allergenCode: string;
  quantity: number;
};

type Allocation = {
  allergenId: string;
  lotId: string;
  warehouse: string;
  quantity: number;
};

type Shortage = RequestedItem;

export type ShipmentAllocationInput = {
  lotId: string;
  warehouse: string;
  quantity: number;
};

function allocationKey(lotId: string, warehouse: string) {
  return `${lotId}\u0000${warehouse}`;
}

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
  selectedAllocations?: ShipmentAllocationInput[],
  shipmentMemo?: string
) {
  const normalizedShipmentMemo = shipmentMemo?.trim();

  if (normalizedShipmentMemo && normalizedShipmentMemo.length > 500) {
    throw new Error("SHIPMENT_MEMO_TOO_LONG");
  }

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
    const shortages: Shortage[] = [];
    const activeWarehouses = await tx.warehouse.findMany({
      where: { isActive: true },
      select: { code: true }
    });
    const activeWarehouseCodes = activeWarehouses.map((warehouse) => warehouse.code);
    const activeWarehouseSet = new Set(activeWarehouseCodes);

    if (selectedAllocations) {
      const normalized = new Map<string, ShipmentAllocationInput>();
      for (const allocation of selectedAllocations) {
        if (
          !allocation.lotId ||
          !allocation.warehouse ||
          !activeWarehouseSet.has(allocation.warehouse) ||
          !Number.isInteger(allocation.quantity) ||
          allocation.quantity <= 0
        ) {
          throw new Error("INVALID_ALLOCATION");
        }
        const key = allocationKey(allocation.lotId, allocation.warehouse);
        const current = normalized.get(key);
        normalized.set(key, {
          lotId: allocation.lotId,
          warehouse: allocation.warehouse,
          quantity: (current?.quantity ?? 0) + allocation.quantity
        });
      }

      const selectedStocks = await tx.warehouseStock.findMany({
        where: {
          reagentLotId: {
            in: [...new Set(
              [...normalized.values()].map((allocation) => allocation.lotId)
            )]
          },
          warehouse: { in: activeWarehouseCodes },
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
          warehouse: true,
          reagentLot: { select: { allergenId: true } }
        }
      });
      const stockByKey = new Map(selectedStocks.map((stock) => [
        allocationKey(stock.reagentLotId, stock.warehouse),
        stock.reagentLot
      ]));
      const allocatedByAllergen = new Map<string, number>();

      for (const [key, selected] of normalized) {
        const lot = stockByKey.get(key);
        if (!lot || !requestedByAllergen.has(lot.allergenId)) {
          throw new Error("INVALID_ALLOCATION");
        }
        allocatedByAllergen.set(
          lot.allergenId,
          (allocatedByAllergen.get(lot.allergenId) ?? 0) + selected.quantity
        );
        allocations.push({
          allergenId: lot.allergenId,
          lotId: selected.lotId,
          warehouse: selected.warehouse,
          quantity: selected.quantity
        });
      }

      for (const item of requestedByAllergen.values()) {
        const allocatedQuantity = allocatedByAllergen.get(item.allergenId) ?? 0;
        if (allocatedQuantity > item.quantity) {
          throw new Error(`ALLOCATION_QUANTITY_MISMATCH:${item.allergenCode}`);
        }

        if (allocatedQuantity < item.quantity) {
          shortages.push({
            ...item,
            quantity: item.quantity - allocatedQuantity
          });
        }
      }
    } else {
      for (const item of requestedByAllergen.values()) {
        let remaining = item.quantity;
        if (activeWarehouseCodes.length === 0) {
          shortages.push({ ...item, quantity: remaining });
          continue;
        }
        const candidateStocks = await tx.warehouseStock.findMany({
          where: {
            warehouse: { in: activeWarehouseCodes },
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
            { reagentLot: { lotNo: "asc" } },
            { warehouse: "asc" }
          ]
        });

        for (const stock of candidateStocks) {
          if (remaining <= 0) break;
          const quantity = Math.min(stock.quantity, remaining);
          remaining -= quantity;
          allocations.push({
            allergenId: item.allergenId,
            lotId: stock.reagentLotId,
            warehouse: stock.warehouse,
            quantity
          });
        }

        if (remaining > 0) {
          shortages.push({
            ...item,
            quantity: remaining
          });
        }
      }
    }

    if (allocations.length === 0) {
      throw new Error("NO_ALLOCATIONS");
    }

    if (shortages.length > 0 && !normalizedShipmentMemo) {
      throw new Error("PARTIAL_SHIPMENT_MEMO_REQUIRED");
    }

    for (const allocation of allocations) {
      const deduction = await tx.warehouseStock.updateMany({
        where: {
          reagentLotId: allocation.lotId,
          warehouse: allocation.warehouse,
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

    const allocationDescription = selectedAllocations
      ? "수동 LOT 배정 출고"
      : "유통기한 빠른 순 자동 출고";
    const savedShipmentMemo = normalizedShipmentMemo
      ? `${allocationDescription} / 메모: ${normalizedShipmentMemo}`
      : allocationDescription;
    const shipment = await tx.shipment.create({
      data: {
        orderId: order.id,
        status: "SHIPPED",
        fulfillmentStatus: shortages.length > 0 ? "PARTIAL" : "NORMAL",
        shippedBy: actorId,
        memo: savedShipmentMemo
      }
    });

    await tx.shipmentItem.createMany({
      data: allocations.map((allocation) => ({
        shipmentId: shipment.id,
        reagentLotId: allocation.lotId,
        allergenId: allocation.allergenId,
        warehouse: allocation.warehouse,
        quantity: allocation.quantity
      }))
    });

    await tx.stockMovement.createMany({
      data: allocations.map((allocation) => ({
        reagentLotId: allocation.lotId,
        type: "OUT" as const,
        quantity: allocation.quantity,
        warehouse: allocation.warehouse,
        reason: order.orderNo,
        refType: "SHIPMENT",
        refId: shipment.id,
        createdBy: actorId
      }))
    });

    let shortageOrder: { id: string; orderNo: string } | null = null;
    if (shortages.length > 0) {
      try {
        shortageOrder = await tx.order.create({
          data: {
            orderNo: await nextOrderNo(tx, now),
            clientId: order.clientId,
            status: "RECEIVED",
            origin: "SHORTAGE_REORDER",
            shortageFromShipmentId: shipment.id,
            memo: `${order.orderNo} 재고 부족분 자동 재주문`,
            createdBy: actorId,
            items: {
              createMany: {
                data: shortages.map((shortage) => ({
                  allergenId: shortage.allergenId,
                  quantity: shortage.quantity
                }))
              }
            }
          }
        });
      } catch (error) {
        if (isOrderNumberConflict(error)) {
          throw new RetryableTransactionError();
        }
        throw error;
      }
    }

    if (shortageOrder) {
      await tx.auditLog.create({
        data: {
          action: "ORDER_CREATE_SHORTAGE_REORDER",
          entityType: "ORDER",
          entityId: shortageOrder.id,
          description: `${order.orderNo} 부족분 재주문 생성: ${shortageOrder.orderNo}`,
          actorId
        }
      });
    }

    await tx.auditLog.create({
      data: {
        action: "SHIPMENT_CREATE",
        entityType: "SHIPMENT",
        entityId: shipment.id,
        description: `${order.orderNo} 출고 처리 · ${savedShipmentMemo}`,
        actorId
      }
    });

    return {
      ...shipment,
      shortageOrder
    };
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
        order: true,
        shortageReorder: {
          select: {
            id: true,
            status: true
          }
        }
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

    if (shipment.shortageReorder?.status === "SHIPPED") {
      throw new Error("SHORTAGE_REORDER_ALREADY_SHIPPED");
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
            warehouse: item.warehouse
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
        warehouse: item.warehouse,
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

    if (
      shipment.shortageReorder &&
      (shipment.shortageReorder.status === "RECEIVED" || shipment.shortageReorder.status === "READY_TO_SHIP")
    ) {
      const cancelledShortageOrder = await tx.order.updateMany({
        where: {
          id: shipment.shortageReorder.id,
          status: {
            in: ["RECEIVED", "READY_TO_SHIP"]
          }
        },
        data: {
          status: "CANCELLED"
        }
      });

      if (cancelledShortageOrder.count !== 1) {
        throw new RetryableTransactionError();
      }

      await tx.auditLog.create({
        data: {
          action: "ORDER_CANCEL_SHORTAGE_REORDER",
          entityType: "ORDER",
          entityId: shipment.shortageReorder.id,
          description: `${shipment.order.orderNo} 출고 취소로 부족분 재주문 취소`,
          actorId
        }
      });
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
