import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  updateShipmentMemo: vi.fn(),
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/prisma", () => ({ prisma: { kind: "test-db" } }));
vi.mock("@/services/shipment-service", () => ({
  processShipment: vi.fn(),
  reverseShipment: vi.fn(),
  updateShipmentMemo: mocks.updateShipmentMemo
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateShipment } from "./actions";

describe("shipment metadata update action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "user-1" });
  });

  it("updates the shipment memo and its order image together", async () => {
    const data = new FormData();
    data.set("shipmentId", "shipment-1");
    data.set("memo", "출고 메모 수정");
    data.set("image", new File([
      new Uint8Array([0xff, 0xd8, 0xff])
    ], "주문서.jpg", { type: "image/jpeg" }));

    try { await updateShipment(data); } catch { /* expected Next.js redirect */ }

    expect(mocks.updateShipmentMemo).toHaveBeenCalledWith(
      { kind: "test-db" },
      "shipment-1",
      "user-1",
      "출고 메모 수정",
      expect.objectContaining({ fileName: "주문서.jpg", byteSize: 3 })
    );
  });
});
