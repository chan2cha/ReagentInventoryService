import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { RetryableTransactionError, runSerializableTransaction } from "./transaction";

function databaseWith(transaction: ReturnType<typeof vi.fn>) {
  return {
    $transaction: transaction
  } as unknown as PrismaClient;
}

describe("runSerializableTransaction", () => {
  it("retries Prisma serialization conflicts within a fixed limit", async () => {
    const transaction = vi.fn()
      .mockRejectedValueOnce({ code: "P2034" })
      .mockResolvedValueOnce("completed");

    await expect(runSerializableTransaction(
      databaseWith(transaction),
      vi.fn(),
      2
    )).resolves.toBe("completed");
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: "Serializable"
    });
  });

  it("retries explicit compare-and-set conflicts", async () => {
    const transaction = vi.fn()
      .mockRejectedValueOnce(new RetryableTransactionError())
      .mockResolvedValueOnce("completed");

    await expect(runSerializableTransaction(
      databaseWith(transaction),
      vi.fn(),
      2
    )).resolves.toBe("completed");
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("does not retry business errors and maps an exhausted conflict", async () => {
    const businessTransaction = vi.fn().mockRejectedValue(new Error("ORDER_CANCELLED"));
    await expect(runSerializableTransaction(
      databaseWith(businessTransaction),
      vi.fn(),
      3
    )).rejects.toThrow("ORDER_CANCELLED");
    expect(businessTransaction).toHaveBeenCalledTimes(1);

    const conflictedTransaction = vi.fn().mockRejectedValue({ code: "P2034" });
    await expect(runSerializableTransaction(
      databaseWith(conflictedTransaction),
      vi.fn(),
      2
    )).rejects.toThrow("TRANSACTION_CONFLICT");
    expect(conflictedTransaction).toHaveBeenCalledTimes(2);
  });
});
