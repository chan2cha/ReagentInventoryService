import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createOrderValue } from "./order-create-service";

function transactionDatabase(tx: object) {
  return {
    $transaction: vi.fn((operation: (client: object) => unknown) => operation(tx))
  } as unknown as PrismaClient;
}

function transactionClient() {
  return {
    client: {
      findFirst: vi.fn().mockResolvedValue({ id: "client-1" })
    },
    allergen: {
      count: vi.fn().mockResolvedValue(2)
    },
    order: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "order-1" })
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" })
    }
  };
}

const input = {
  clientId: "client-1",
  memo: "정기 주문",
  items: [
    { allergenId: "allergen-1", quantity: 2 },
    { allergenId: "allergen-2", quantity: 3 }
  ],
  actorId: "user-1",
  now: new Date("2030-01-15T03:00:00.000Z")
};

describe("createOrderValue", () => {
  it("creates an order and audit record with active master data", async () => {
    const tx = transactionClient();
    const db = transactionDatabase(tx);

    await expect(createOrderValue(db, input)).resolves.toEqual({ id: "order-1" });
    expect(tx.client.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: input.clientId,
        isActive: true
      }
    }));
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderNo: "ORD-20300115-001",
        clientId: input.clientId,
        createdBy: input.actorId,
        items: {
          createMany: {
            data: input.items
          }
        }
      })
    });
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("stores an optional order image in the same order transaction", async () => {
    const tx = transactionClient();
    const image = {
      fileName: "order.png",
      contentType: "image/png" as const,
      byteSize: 8,
      data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    };

    await createOrderValue(transactionDatabase(tx), { ...input, image });

    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        image: {
          create: image
        }
      })
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: expect.stringContaining("이미지 첨부")
      })
    });
  });

  it("rejects an inactive or missing client before creating an order", async () => {
    const tx = transactionClient();
    tx.client.findFirst.mockResolvedValue(null);

    await expect(createOrderValue(transactionDatabase(tx), input))
      .rejects.toThrow("CLIENT_NOT_FOUND");
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("retries an order-number unique conflict with the next sequence", async () => {
    const tx = transactionClient();
    tx.order.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ orderNo: "ORD-20300115-001" });
    tx.order.create
      .mockRejectedValueOnce({ code: "P2002", meta: { target: ["orderNo"] } })
      .mockResolvedValueOnce({ id: "order-2" });
    const db = transactionDatabase(tx);

    await expect(createOrderValue(db, input)).resolves.toEqual({ id: "order-2" });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.order.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        orderNo: "ORD-20300115-002"
      })
    });
  });

  it("stops at the documented three-digit daily order limit", async () => {
    const tx = transactionClient();
    tx.order.findFirst.mockResolvedValue({ orderNo: "ORD-20300115-999" });

    await expect(createOrderValue(transactionDatabase(tx), input))
      .rejects.toThrow("ORDER_DAILY_LIMIT_REACHED");
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});
