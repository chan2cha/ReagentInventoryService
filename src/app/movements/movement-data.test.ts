import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stockMovement: {
      count: mocks.count,
      findMany: mocks.findMany
    }
  }
}));

import { getMovementRows } from "./movement-data";

describe("getMovementRows movement-type filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([{
      id: "movement-1",
      createdAt: new Date("2026-07-13T01:30:00.000Z"),
      type: "OUT",
      quantity: 3,
      warehouse: "FINISHED_GOODS",
      destinationWarehouse: null,
      reason: "ORD-001",
      reagentLot: {
        lotNo: "LOT-001",
        allergen: {
          name: "난백",
          code: "EGG-01"
        }
      }
    }]);
  });

  it("applies one shared search and type predicate to count and row queries", async () => {
    const result = await getMovementRows(1, " EGG ", "OUT", "FINISHED_GOODS");
    const expectedWhere = expect.objectContaining({
      type: "OUT",
      OR: expect.any(Array),
      AND: [{
        OR: [
          { warehouse: "FINISHED_GOODS" },
          { destinationWarehouse: "FINISHED_GOODS" }
        ]
      }]
    });

    expect(mocks.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expectedWhere,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ]
    }));
    expect(result.rows).toEqual([expect.objectContaining({
      id: "movement-1",
      type: "출고",
      allergenCode: "EGG-01",
      lotNo: "LOT-001",
      warehouse: "완제품",
      destinationWarehouse: null
    })]);
  });

  it("presents both warehouses for a transfer movement", async () => {
    mocks.findMany.mockResolvedValue([{
      id: "movement-transfer",
      createdAt: new Date("2026-07-13T02:30:00.000Z"),
      type: "TRANSFER",
      quantity: 2,
      warehouse: "FINISHED_GOODS",
      destinationWarehouse: "SAMPLE",
      reason: "검체 보관",
      reagentLot: {
        lotNo: "LOT-001",
        allergen: { name: "난백", code: "EGG-01" }
      }
    }]);

    const result = await getMovementRows(1);

    expect(result.rows[0]).toMatchObject({
      type: "창고이동",
      warehouse: "완제품",
      destinationWarehouse: "검체",
      quantity: 2
    });
  });
});
