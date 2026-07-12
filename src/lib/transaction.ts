import type { Prisma, PrismaClient } from "@prisma/client";

const DEFAULT_MAX_ATTEMPTS = 3;

export class RetryableTransactionError extends Error {
  constructor() {
    super("RETRYABLE_TRANSACTION_CONFLICT");
    this.name = "RetryableTransactionError";
  }
}

function prismaErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
}

function isRetryable(error: unknown) {
  return error instanceof RetryableTransactionError || prismaErrorCode(error) === "P2034";
}

export async function runSerializableTransaction<T>(
  db: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = DEFAULT_MAX_ATTEMPTS
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: "Serializable"
      });
    } catch (error) {
      if (!isRetryable(error)) {
        throw error;
      }

      if (attempt === maxAttempts) {
        throw new Error("TRANSACTION_CONFLICT");
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 10));
    }
  }

  throw new Error("TRANSACTION_CONFLICT");
}
