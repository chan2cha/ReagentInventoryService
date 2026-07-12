import type { PrismaClient } from "@prisma/client";
import type { StockAdjustmentType } from "../domain/stock-adjustment";
import { RetryableTransactionError, runSerializableTransaction } from "../lib/transaction";

type AdjustLotStockInput = {
  lotId: string;
  quantity: number;
  type: StockAdjustmentType;
  reason: string;
  actorId: string;
};

export async function adjustLotStockValue(db: PrismaClient, input: AdjustLotStockInput) {
  if (!Number.isInteger(input.quantity) || input.quantity === 0) {
    throw new Error("ADJUSTMENT_QUANTITY_INVALID");
  }

  return runSerializableTransaction(db, async (tx) => {
    const amount = Math.abs(input.quantity);
    const result = input.quantity > 0
      ? await tx.reagentLot.updateMany({
          where: {
            id: input.lotId
          },
          data: {
            currentQuantity: {
              increment: amount
            }
          }
        })
      : await tx.reagentLot.updateMany({
          where: {
            id: input.lotId,
            currentQuantity: {
              gte: amount
            }
          },
          data: {
            currentQuantity: {
              decrement: amount
            }
          }
        });

    if (result.count !== 1) {
      const lot = await tx.reagentLot.findUnique({
        where: {
          id: input.lotId
        },
        select: {
          currentQuantity: true
        }
      });

      if (!lot) {
        throw new Error("LOT_NOT_FOUND");
      }

      if (input.quantity < 0 && lot.currentQuantity < amount) {
        throw new Error("ADJUSTMENT_STOCK_NEGATIVE");
      }

      throw new RetryableTransactionError();
    }

    await tx.stockMovement.create({
      data: {
        reagentLotId: input.lotId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
        refType: "STOCK_ADJUSTMENT",
        refId: input.lotId,
        createdBy: input.actorId
      }
    });

    return {
      lotId: input.lotId,
      quantity: input.quantity
    };
  });
}
