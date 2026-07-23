import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createOrderValue: vi.fn(),
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/prisma", () => ({ prisma: { kind: "test-db" } }));
vi.mock("@/services/order-create-service", () => ({
  createOrderValue: mocks.createOrderValue
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createOrder } from "./actions";

async function captureThrown(run: Promise<unknown>) {
  try {
    await run;
  } catch (error) {
    return error;
  }

  throw new Error("Expected action redirect");
}

function redirectDigest(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error
    ? String(error.digest)
    : "";
}

describe("create order action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "user-1" });
    mocks.createOrderValue.mockResolvedValue({ id: "order-1" });
  });

  it("submits multiple manually entered items and preserves the success redirect", async () => {
    const data = new FormData();
    data.set("clientId", "client-1");
    data.set("memo", "수동 주문");
    for (const [allergenId, quantity] of [
      ["allergen-1", "7"],
      ["allergen-2", "2"],
      ["allergen-3", "3"]
    ]) {
      data.append("allergenId", allergenId);
      data.append("quantity", quantity);
    }

    const error = await captureThrown(createOrder(data));

    expect(mocks.requireRole).toHaveBeenCalledWith(["ADMIN", "ORDER_MANAGER"]);
    expect(mocks.createOrderValue).toHaveBeenCalledWith(
      { kind: "test-db" },
      {
        clientId: "client-1",
        memo: "수동 주문",
        actorId: "user-1",
        items: [
          { allergenId: "allergen-1", quantity: 7 },
          { allergenId: "allergen-2", quantity: 2 },
          { allergenId: "allergen-3", quantity: 3 }
        ]
      }
    );
    // A direct function call has no Server Action request context, so Next uses
    // its generic 307 digest here; the HTTP Server Action runtime converts it to
    // the 303 response already covered by the built-server regression test.
    expect(redirectDigest(error)).toMatch(/\/orders;30[37];/);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders");
  });

  it("validates and forwards an optional order image", async () => {
    const data = new FormData();
    data.set("clientId", "client-1");
    data.append("allergenId", "allergen-1");
    data.append("quantity", "1");
    data.set("image", new File([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ], "주문서.png", { type: "image/png" }));

    await captureThrown(createOrder(data));

    expect(mocks.createOrderValue).toHaveBeenCalledWith(
      { kind: "test-db" },
      expect.objectContaining({
        image: {
          fileName: "주문서.png",
          contentType: "image/png",
          byteSize: 8,
          data: expect.any(Uint8Array)
        }
      })
    );
  });

  it("submits without an image when the browser sends an empty file placeholder", async () => {
    const data = new FormData();
    data.set("clientId", "client-1");
    data.append("allergenId", "allergen-1");
    data.append("quantity", "1");
    data.set("image", new File([], "placeholder", { type: "application/octet-stream" }));

    await captureThrown(createOrder(data));

    expect(mocks.createOrderValue).toHaveBeenCalledWith(
      { kind: "test-db" },
      expect.not.objectContaining({ image: expect.anything() })
    );
  });
});
