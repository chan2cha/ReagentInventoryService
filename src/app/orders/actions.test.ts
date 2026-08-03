import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  updatePendingOrder: vi.fn(),
  updateShippedOrderMetadata: vi.fn(),
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/prisma", () => ({ prisma: { kind: "test-db" } }));
vi.mock("@/services/order-service", () => ({
  cancelPendingOrder: vi.fn(),
  updatePendingOrder: mocks.updatePendingOrder,
  updateShippedOrderMetadata: mocks.updateShippedOrderMetadata
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateOrder, updateOrderMetadata } from "./actions";

async function ignoreRedirect(run: Promise<unknown>) {
  try { await run; } catch { /* expected Next.js redirect */ }
}

describe("order update actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "user-1" });
  });

  it("validates and forwards a replacement image with a pending order update", async () => {
    const data = new FormData();
    data.set("orderId", "order-1");
    data.set("clientId", "client-1");
    data.set("memo", "수정 메모");
    data.append("allergenId", "allergen-1");
    data.append("quantity", "2");
    data.set("image", new File([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ], "교체.png", { type: "image/png" }));

    await ignoreRedirect(updateOrder(data));

    expect(mocks.updatePendingOrder).toHaveBeenCalledWith(
      { kind: "test-db" },
      "order-1",
      "user-1",
      expect.objectContaining({
        memo: "수정 메모",
        image: expect.objectContaining({ fileName: "교체.png", byteSize: 8 })
      })
    );
  });

  it("limits a shipped order update payload to memo and image deletion", async () => {
    const data = new FormData();
    data.set("orderId", "order-1");
    data.set("memo", "출고 후 메모");
    data.set("removeImage", "1");

    await ignoreRedirect(updateOrderMetadata(data));

    expect(mocks.updateShippedOrderMetadata).toHaveBeenCalledWith(
      { kind: "test-db" },
      "order-1",
      "user-1",
      { memo: "출고 후 메모", image: null }
    );
  });
});
