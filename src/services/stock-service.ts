import type { PrismaClient, Warehouse } from "@prisma/client";
import type { StockAdjustmentType } from "../domain/stock-adjustment";
import { RetryableTransactionError, runSerializableTransaction } from "../lib/transaction";

type AdjustLotStockInput = {
  lotId: string;
  quantity: number;
  type: StockAdjustmentType;
  reason: string;
  actorId: string;
  warehouse?: Warehouse;
};

export async function adjustLotStockValue(db: PrismaClient, input: AdjustLotStockInput) {
  if (!Number.isInteger(input.quantity) || input.quantity === 0) {
    throw new Error("ADJUSTMENT_QUANTITY_INVALID");
  }

  return runSerializableTransaction(db, async (tx) => {
    const warehouse = input.warehouse ?? "FINISHED_GOODS";
    const amount = Math.abs(input.quantity);
    const result = input.quantity > 0
      ? await tx.warehouseStock.updateMany({
          where: {
            reagentLotId: input.lotId,
            warehouse
          },
          data: {
            quantity: {
              increment: amount
            }
          }
        })
      : await tx.warehouseStock.updateMany({
          where: {
            reagentLotId: input.lotId,
            warehouse,
            quantity: {
              gte: amount
            }
          },
          data: {
            quantity: {
              decrement: amount
            }
          }
        });

    if (result.count !== 1) {
      const stock = await tx.warehouseStock.findUnique({
        where: {
          reagentLotId_warehouse: {
            reagentLotId: input.lotId,
            warehouse
          }
        },
        select: {
          quantity: true
        }
      });

      if (!stock) {
        const lot = await tx.reagentLot.findUnique({
          where: { id: input.lotId },
          select: { id: true }
        });
        throw new Error(lot ? "WAREHOUSE_STOCK_NOT_FOUND" : "LOT_NOT_FOUND");
      }

      if (input.quantity < 0 && stock.quantity < amount) {
        throw new Error("ADJUSTMENT_STOCK_NEGATIVE");
      }

      throw new RetryableTransactionError();
    }

    await tx.stockMovement.create({
      data: {
        reagentLotId: input.lotId,
        type: input.type,
        quantity: input.quantity,
        warehouse,
        reason: input.reason,
        refType: "STOCK_ADJUSTMENT",
        refId: input.lotId,
        createdBy: input.actorId
      }
    });

    return {
      lotId: input.lotId,
      quantity: input.quantity,
      warehouse
    };
  });
}
