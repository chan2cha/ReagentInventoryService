import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      count: mocks.count
    }
  }
}));

import { formatSidebarBadge, getSidebarData } from "./sidebar-data";

describe("sidebar shipment badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts real pending shipment orders and formats large badges", async () => {
    mocks.count.mockResolvedValue(123);

    await expect(getSidebarData()).resolves.toEqual({ pendingShipments: 123 });
    expect(mocks.count).toHaveBeenCalledWith({
      where: {
        status: {
          in: ["RECEIVED", "READY_TO_SHIP"]
        }
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
    mocks.count.mockRejectedValue(error);

    await expect(getSidebarData()).resolves.toEqual({ pendingShipments: null });
    expect(consoleError).toHaveBeenCalledWith(
      "[sidebar-data] pending shipment count failed",
      error
    );
    expect(formatSidebarBadge(null)).toBeNull();

    consoleError.mockRestore();
  });
});
