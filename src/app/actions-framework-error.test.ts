import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  cancelPendingOrder: vi.fn(),
  adjustLotStockValue: vi.fn(),
  transferWarehouseStock: vi.fn(),
  processShipment: vi.fn(),
  reverseShipment: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/services/order-service", () => ({
  cancelPendingOrder: mocks.cancelPendingOrder
}));
vi.mock("@/services/stock-service", () => ({
  adjustLotStockValue: mocks.adjustLotStockValue
}));
vi.mock("@/services/warehouse-transfer-service", () => ({
  transferWarehouseStock: mocks.transferWarehouseStock
}));
vi.mock("@/services/shipment-service", () => ({
  processShipment: mocks.processShipment,
  reverseShipment: mocks.reverseShipment
}));

import { adjustLotStock, transferLotWarehouse } from "@/app/lots/actions";
import { cancelOrder } from "@/app/orders/actions";
import { createOrder } from "@/app/orders/new/actions";
import { createReceivingLot } from "@/app/receiving/actions";
import { cancelShipment, shipOrder } from "@/app/shipments/actions";

function redirectError(path: string): unknown {
  try {
    redirect(path as never);
  } catch (error) {
    return error;
  }

  throw new Error("Expected redirect() to throw");
}

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.append(key, value);
  }
  return data;
}

describe("Server Action framework error handling", () => {
  let authRedirect: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    authRedirect = redirectError("/login");
    mocks.requireRole.mockRejectedValue(authRedirect);
  });

  it.each([
    [
      "order creation",
      () => createOrder(formData({ clientId: "client-1", allergenId: "allergen-1", quantity: "1" }))
    ],
    [
      "order cancellation",
      () => cancelOrder(formData({ orderId: "order-1", reason: "test" }))
    ],
    [
      "receiving",
      () => createReceivingLot(formData({
        allergenId: "allergen-1",
        lotNo: "LOT-1",
        quantity: "1",
        receivedDate: "2026-07-01",
        expirationDate: "2026-07-02"
      }))
    ],
    [
      "stock adjustment",
      () => adjustLotStock(formData({
        lotId: "lot-1",
        operation: "ADD",
        quantity: "1",
        reason: "test"
      }))
    ],
    [
      "warehouse transfer",
      () => transferLotWarehouse(formData({
        lotId: "lot-1",
        sourceWarehouse: "FINISHED_GOODS",
        destinationWarehouse: "SAMPLE",
        quantity: "1",
        reason: "test"
      }))
    ],
    [
      "shipment",
      () => shipOrder(formData({ orderId: "order-1" }))
    ],
    [
      "shipment cancellation",
      () => cancelShipment(formData({ shipmentId: "shipment-1", reason: "test" }))
    ]
  ])("preserves a Next.js redirect from %s", async (_name, runAction) => {
    await expect(runAction()).rejects.toBe(authRedirect);
  });
});
