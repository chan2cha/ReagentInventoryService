import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderCount: vi.fn(),
  shipmentItemCount: vi.fn(),
  getReplacementPolicy: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      count: mocks.orderCount
    },
    shipmentItem: {
      count: mocks.shipmentItemCount
    }
  }
}));
vi.mock("@/services/replacement-service", () => ({
  getReplacementPolicy: mocks.getReplacementPolicy
}));

import { formatSidebarBadge, getSidebarData } from "./sidebar-data";

describe("sidebar notification badges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts real pending shipment orders and formats large badges", async () => {
    mocks.getReplacementPolicy.mockResolvedValue({ detectionDays: 60 });
    mocks.orderCount.mockResolvedValue(123);
    mocks.shipmentItemCount.mockResolvedValue(4);

    await expect(getSidebarData()).resolves.toEqual({ pendingShipments: 123, replacementCandidates: 4 });
    expect(mocks.orderCount).toHaveBeenCalledWith({
      where: {
        status: {
          in: ["RECEIVED", "READY_TO_SHIP"]
        }
      }
    });
    expect(mocks.shipmentItemCount).toHaveBeenCalledWith({
      where: {
        shipment: { status: "SHIPPED", purpose: "ORDER" },
        reagentLot: { expirationDate: { lte: expect.any(Date) } },
        replacement: { is: null }
      }
    });
    expect(formatSidebarBadge(1)).toBe("1");
    expect(formatSidebarBadge(99)).toBe("99");
    expect(formatSidebarBadge(100)).toBe("99+");
    expect(formatSidebarBadge(0)).toBeNull();
  });

  it("hides the badge without breaking every page when the count query fails", async () => {
    const error = new Error("database unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getReplacementPolicy.mockRejectedValue(error);

    await expect(getSidebarData()).resolves.toEqual({ pendingShipments: null, replacementCandidates: null });
    expect(consoleError).toHaveBeenCalledWith(
      "[sidebar-data] sidebar notification count failed",
      error
    );
    expect(formatSidebarBadge(null)).toBeNull();

    consoleError.mockRestore();
  });
});
