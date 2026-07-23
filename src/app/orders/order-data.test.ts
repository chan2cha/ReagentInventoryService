import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      count: mocks.count,
      findMany: mocks.findMany
    }
  }
}));

import { getOrderRows } from "./order-data";

describe("getOrderRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([{
      id: "order-1",
      orderNo: "ORD-20260721-001",
      client: { name: "테스트 병원", managerName: "김담당" },
      createdAt: new Date("2026-07-21T03:00:00.000Z"),
      items: [{
        id: "item-1",
        quantity: 2,
        allergen: { code: "R-001", name: "테스트 시약" }
      }],
      memo: "이미지 주문",
      image: { fileName: "order.png", byteSize: 2048 },
      origin: "MANUAL",
      status: "RECEIVED"
    }]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("selects and maps image metadata without loading image bytes", async () => {
    const result = await getOrderRows(1);

    expect(result.rows).toEqual([
      expect.objectContaining({
        id: "order-1",
        image: { fileName: "order.png", byteSize: 2048 },
        origin: "신규주문"
      })
    ]);

    const query = mocks.findMany.mock.calls[0]?.[0];
    expect(query.include.image).toEqual({
      select: {
        fileName: true,
        byteSize: true
      }
    });
    expect(query.include.image.select).not.toHaveProperty("data");
  });

  it("applies the same KST order-date range used by the Excel export", async () => {
    await getOrderRows(1, "병원", "2026-07-21", "2026-07-21");

    expect(mocks.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        origin: "MANUAL",
        OR: expect.any(Array),
        createdAt: {
          gte: new Date("2026-07-20T15:00:00.000Z"),
          lt: new Date("2026-07-21T15:00:00.000Z")
        }
      })
    });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        createdAt: expect.any(Object)
      })
    }));
  });

  it("uses null image metadata for development sample rows", async () => {
    vi.stubEnv("ALLOW_SAMPLE_DATA", "true");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.count.mockRejectedValue(new Error("database unavailable"));

    const result = await getOrderRows(1);

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every((row) => row.image === null)).toBe(true);
  });
});
