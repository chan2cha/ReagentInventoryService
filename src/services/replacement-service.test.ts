import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSerializableTransaction: vi.fn(),
  shipmentItemFindUnique: vi.fn(),
  replacementFindFirst: vi.fn(),
  replacementCreate: vi.fn(),
  auditLogCreate: vi.fn()
}));

vi.mock("../lib/transaction", () => ({
  RetryableTransactionError: class RetryableTransactionError extends Error {},
  runSerializableTransaction: mocks.runSerializableTransaction
}));

import { registerDefectReplacement } from "./replacement-service";

describe("registerDefectReplacement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runSerializableTransaction.mockImplementation(async (_db, callback) => callback({
      shipmentItem: { findUnique: mocks.shipmentItemFindUnique },
      replacement: {
        findFirst: mocks.replacementFindFirst,
        create: mocks.replacementCreate
      },
      auditLog: { create: mocks.auditLogCreate }
    }));
    mocks.shipmentItemFindUnique.mockResolvedValue({
      id: "shipment-item-1",
      quantity: 3,
      shipment: { status: "SHIPPED", purpose: "ORDER" },
      replacement: null
    });
    mocks.replacementFindFirst.mockResolvedValue(null);
    mocks.replacementCreate.mockResolvedValue({ id: "replacement-1" });
    mocks.auditLogCreate.mockResolvedValue({});
  });

  it("records a product-defect replacement for an existing shipped item", async () => {
    await registerDefectReplacement({} as never, {
      shipmentItemId: "shipment-item-1",
      quantity: 2,
      reason: "포장 파손",
      actorId: "admin-1",
      now: new Date("2026-07-23T00:00:00.000Z")
    });

    expect(mocks.replacementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        replacementNo: "REP-20260723-001",
        originalShipmentItemId: "shipment-item-1",
        confirmedQuantity: 2,
        origin: "PRODUCT_DEFECT",
        reason: "포장 파손",
        status: "CONFIRMED",
        createdBy: "admin-1"
      })
    });
  });

  it("requires a defect reason before creating the replacement", async () => {
    await expect(registerDefectReplacement({} as never, {
      shipmentItemId: "shipment-item-1",
      quantity: 1,
      reason: "  ",
      actorId: "admin-1"
    })).rejects.toThrow("REPLACEMENT_REASON_REQUIRED");

    expect(mocks.runSerializableTransaction).not.toHaveBeenCalled();
  });
});
