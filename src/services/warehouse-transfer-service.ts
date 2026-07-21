import type { PrismaClient } from "@prisma/client";
import {
  warehouseLabel,
  type WarehouseKind
} from "../domain/warehouse";
import {
  RetryableTransactionError,
  runSerializableTransaction
} from "../lib/transaction";

export type WarehouseTransferInput = {
  lotId: string;
  sourceWarehouse: WarehouseKind;
  destinationWarehouse: WarehouseKind;
  quantity: number;
  reason: string;
  actorId: string;
};

export async function transferWarehouseStock(
  db: PrismaClient,
  input: WarehouseTransferInput
) {
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("WAREHOUSE_TRANSFER_QUANTITY_INVALID");
  }

  if (input.sourceWarehouse === input.destinationWarehouse) {
    throw new Error("WAREHOUSE_TRANSFER_SAME_WAREHOUSE");
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("WAREHOUSE_TRANSFER_REASON_REQUIRED");
  }

  return runSerializableTransaction(db, async (tx) => {
    const lot = await tx.reagentLot.findUnique({
      where: {
        id: input.lotId
      },
      select: {
        id: true,
        lotNo: true
      }
    });

    if (!lot) {
      throw new Error("LOT_NOT_FOUND");
    }

    const sourceChange = await tx.warehouseStock.updateMany({
      where: {
        reagentLotId: lot.id,
        warehouse: input.sourceWarehouse,
        quantity: {
          gte: input.quantity
        }
      },
      data: {
        quantity: {
          decrement: input.quantity
        }
      }
    });

    if (sourceChange.count !== 1) {
      const source = await tx.warehouseStock.findUnique({
        where: {
          reagentLotId_warehouse: {
            reagentLotId: lot.id,
            warehouse: input.sourceWarehouse
          }
        },
        select: {
          quantity: true
        }
      });

      if (!source || source.quantity < input.quantity) {
        throw new Error("WAREHOUSE_TRANSFER_STOCK_INSUFFICIENT");
      }

      throw new RetryableTransactionError();
    }

    await tx.warehouseStock.upsert({
      where: {
        reagentLotId_warehouse: {
          reagentLotId: lot.id,
          warehouse: input.destinationWarehouse
        }
      },
      update: {
        quantity: {
          increment: input.quantity
        }
      },
      create: {
        reagentLotId: lot.id,
        warehouse: input.destinationWarehouse,
        quantity: input.quantity
      }
    });

    const movement = await tx.stockMovement.create({
      data: {
        reagentLotId: lot.id,
        type: "TRANSFER",
        quantity: input.quantity,
        warehouse: input.sourceWarehouse,
        destinationWarehouse: input.destinationWarehouse,
        reason,
        refType: "WAREHOUSE_TRANSFER",
        refId: lot.id,
        createdBy: input.actorId
      }
    });

    await tx.auditLog.create({
      data: {
        action: "STOCK_TRANSFER",
        entityType: "STOCK_MOVEMENT",
        entityId: movement.id,
        description: `${lot.lotNo} ${warehouseLabel(input.sourceWarehouse)} → ${warehouseLabel(input.destinationWarehouse)} ${input.quantity}개 이동: ${reason}`,
        actorId: input.actorId
      }
    });

    return {
      movementId: movement.id,
      lotId: lot.id,
      sourceWarehouse: input.sourceWarehouse,
      destinationWarehouse: input.destinationWarehouse,
      quantity: input.quantity
    };
  });
}
