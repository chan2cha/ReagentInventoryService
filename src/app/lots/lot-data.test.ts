import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  queryRaw: vi.fn()
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    warehouseStock: {
      count: mocks.count,
      findMany: mocks.findMany
    }
  }
}));

import { getLotRows } from "./lot-data";

function warehouseStock(
  id: string,
  currentQuantity: number,
  expirationDate: string,
  minStock = 5,
  warehouse = "FINISHED_GOODS"
) {
  return {
    reagentLotId: id,
    warehouse,
    quantity: currentQuantity,
    reagentLot: {
      lotNo: `LOT-${id}`,
      receivedDate: new Date("2026-06-01T00:00:00.000Z"),
      expirationDate: new Date(`${expirationDate}T00:00:00.000Z`),
      initialQuantity: 10,
      allergen: {
        name: "난백",
        code: "EGG-01",
        minStock
      }
    }
  };
}

function statusFilteredLot(id: string, currentQuantity: number, minStock = 5) {
  return {
    id,
    warehouse: "SAMPLE",
    lotNo: `LOT-${id}`,
    receivedDate: new Date("2026-06-01T00:00:00.000Z"),
    expirationDate: new Date("2026-08-20T00:00:00.000Z"),
    currentQuantity,
    initialQuantity: 10,
    memo: null,
    isActive: true,
    allergenName: "난백",
    allergenCode: "EGG-01",
    allergenCategory: null,
    minStock
  };
}

describe("getLotRows status filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters and paginates low-stock lots in the database", async () => {
    mocks.queryRaw
      .mockResolvedValueOnce([{ total: BigInt(1) }])
      .mockResolvedValueOnce([statusFilteredLot("low", 2)]);

    const result = await getLotRows(
      1,
      " EGG ",
      "LOW_STOCK",
      "SAMPLE",
      new Date("2026-07-13T03:00:00.000Z")
    );

    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      page: 1,
      total: 1,
      totalPages: 1,
      rows: [{
        id: "low:SAMPLE",
        lotId: "low",
        warehouse: "SAMPLE",
        allergenCode: "EGG-01",
        status: "재고부족",
        source: "database"
      }]
    });
    expect(mocks.queryRaw.mock.calls[0]?.[0]?.values).toContain("SAMPLE");
  });

  it("queries and returns warehouse-stock rows for ordinary statuses", async () => {
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([
      warehouseStock("returned", 3, "2026-07-25", 5, "RETURNED")
    ]);

    const result = await getLotRows(
      1,
      "",
      "EXPIRING",
      "RETURNED",
      new Date("2026-07-13T03:00:00.000Z")
    );

    expect(mocks.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ warehouse: "RETURNED" }])
      })
    });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ warehouse: "RETURNED" }])
      }),
      orderBy: [
        { reagentLot: { expirationDate: "asc" } },
        { reagentLot: { lotNo: "asc" } },
        { warehouse: "asc" },
        { reagentLotId: "asc" }
      ]
    }));
    expect(result.rows).toEqual([expect.objectContaining({
      id: "returned:RETURNED",
      lotId: "returned",
      warehouse: "RETURNED",
      currentQuantity: 3
    })]);
  });
});
