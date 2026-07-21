import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  transferWarehouseStock,
  type WarehouseTransferInput
} from "./warehouse-transfer-service";

function transactionDatabase(tx: object) {
  return {
    $transaction: vi.fn((operation: (client: object) => unknown) => operation(tx))
  } as unknown as PrismaClient;
}

function transactionClient() {
  return {
    reagentLot: {
      findUnique: vi.fn().mockResolvedValue({ id: "lot-1", lotNo: "LOT-001" })
    },
    warehouseStock: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ quantity: 10 }),
      upsert: vi.fn().mockResolvedValue({ quantity: 3 })
    },
    stockMovement: {
      create: vi.fn().mockResolvedValue({ id: "movement-1" })
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" })
    }
  };
}

const input: WarehouseTransferInput = {
  lotId: "lot-1",
  sourceWarehouse: "FINISHED_GOODS",
  destinationWarehouse: "SAMPLE",
  quantity: 3,
  reason: "품질 검사용",
  actorId: "user-1"
};

describe("transferWarehouseStock", () => {
  it("atomically decrements the source, increments the destination, and records history", async () => {
    const tx = transactionClient();
    const db = transactionDatabase(tx);

    await expect(transferWarehouseStock(db, input)).resolves.toEqual({
      movementId: "movement-1",
      lotId: "lot-1",
      sourceWarehouse: "FINISHED_GOODS",
      destinationWarehouse: "SAMPLE",
      quantity: 3
    });

    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable"
    });
    expect(tx.warehouseStock.updateMany).toHaveBeenCalledWith({
      where: {
        reagentLotId: "lot-1",
        warehouse: "FINISHED_GOODS",
        quantity: { gte: 3 }
      },
      data: {
        quantity: { decrement: 3 }
      }
    });
    expect(tx.warehouseStock.upsert).toHaveBeenCalledWith({
      where: {
        reagentLotId_warehouse: {
          reagentLotId: "lot-1",
          warehouse: "SAMPLE"
        }
      },
      update: {
        quantity: { increment: 3 }
      },
      create: {
        reagentLotId: "lot-1",
        warehouse: "SAMPLE",
        quantity: 3
      }
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        reagentLotId: "lot-1",
        type: "TRANSFER",
        quantity: 3,
        warehouse: "FINISHED_GOODS",
        destinationWarehouse: "SAMPLE",
        reason: "품질 검사용",
        refType: "WAREHOUSE_TRANSFER",
        refId: "lot-1",
        createdBy: "user-1"
      }
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "STOCK_TRANSFER",
        entityType: "STOCK_MOVEMENT",
        entityId: "movement-1",
        actorId: "user-1"
      })
    });
  });

  it.each([
    [{ ...input, quantity: 0 }, "WAREHOUSE_TRANSFER_QUANTITY_INVALID"],
    [{ ...input, quantity: 1.5 }, "WAREHOUSE_TRANSFER_QUANTITY_INVALID"],
    [
      { ...input, destinationWarehouse: input.sourceWarehouse },
      "WAREHOUSE_TRANSFER_SAME_WAREHOUSE"
    ],
    [{ ...input, reason: "   " }, "WAREHOUSE_TRANSFER_REASON_REQUIRED"]
  ] as const)("rejects invalid input before opening a transaction", async (invalidInput, code) => {
    const db = transactionDatabase(transactionClient());

    await expect(transferWarehouseStock(db, invalidInput)).rejects.toThrow(code);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a missing LOT without changing either warehouse", async () => {
    const tx = transactionClient();
    tx.reagentLot.findUnique.mockResolvedValue(null);

    await expect(transferWarehouseStock(transactionDatabase(tx), input))
      .rejects.toThrow("LOT_NOT_FOUND");
    expect(tx.warehouseStock.updateMany).not.toHaveBeenCalled();
    expect(tx.warehouseStock.upsert).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it("rejects insufficient source stock before creating destination or history rows", async () => {
    const tx = transactionClient();
    tx.warehouseStock.updateMany.mockResolvedValue({ count: 0 });
    tx.warehouseStock.findUnique.mockResolvedValue({ quantity: 2 });

    await expect(transferWarehouseStock(transactionDatabase(tx), input))
      .rejects.toThrow("WAREHOUSE_TRANSFER_STOCK_INSUFFICIENT");
    expect(tx.warehouseStock.upsert).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("retries a compare-and-set conflict without duplicating the transfer", async () => {
    const tx = transactionClient();
    tx.warehouseStock.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    tx.warehouseStock.findUnique.mockResolvedValue({ quantity: 10 });
    const db = transactionDatabase(tx);

    await expect(transferWarehouseStock(db, input)).resolves.toMatchObject({
      movementId: "movement-1",
      quantity: 3
    });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.warehouseStock.upsert).toHaveBeenCalledOnce();
    expect(tx.stockMovement.create).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("trims the recorded reason", async () => {
    const tx = transactionClient();

    await transferWarehouseStock(transactionDatabase(tx), {
      ...input,
      reason: "  반품 격리  "
    });

    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: "반품 격리"
      })
    });
  });
});
