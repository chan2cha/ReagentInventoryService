import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
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

describe("getLotRows status filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters cross-model low-stock candidates before calculating pagination", async () => {
    mocks.findMany.mockResolvedValue([
      lot("low", 2, "2026-08-20"),
      lot("normal", 7, "2026-08-21"),
      lot("expiring", 1, "2026-07-20")
    ]);

    const result = await getLotRows(
      1,
      " EGG ",
      "LOW_STOCK",
      new Date("2026-07-13T03:00:00.000Z")
    );

    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          expect.objectContaining({ OR: expect.any(Array) }),
          expect.objectContaining({
            expirationDate: { gte: new Date("2026-08-13T00:00:00.000Z") },
            currentQuantity: { not: 0 }
          })
        ]
      },
      take: 500
    }));
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
