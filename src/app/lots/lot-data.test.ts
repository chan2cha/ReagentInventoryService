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
    reagentLot: {
      count: mocks.count,
      findMany: mocks.findMany
    }
  }
}));

import { getLotRows } from "./lot-data";

function lot(
  id: string,
  currentQuantity: number,
  expirationDate: string,
  minStock = 5
) {
  return {
    id,
    lotNo: `LOT-${id}`,
    receivedDate: new Date("2026-06-01T00:00:00.000Z"),
    expirationDate: new Date(`${expirationDate}T00:00:00.000Z`),
    currentQuantity,
    initialQuantity: 10,
    allergen: {
      name: "난백",
      code: "EGG-01",
      minStock
    }
  };
}

function statusFilteredLot(id: string, currentQuantity: number, minStock = 5) {
  return {
    id,
    lotNo: `LOT-${id}`,
    receivedDate: new Date("2026-06-01T00:00:00.000Z"),
    expirationDate: new Date("2026-08-20T00:00:00.000Z"),
    currentQuantity,
    initialQuantity: 10,
    memo: null,
    isActive: true,
    allergenName: "?쒕갚",
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
        id: "low",
        allergenCode: "EGG-01",
        status: "재고부족",
        source: "database"
      }]
    });
  });
});
