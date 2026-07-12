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
    const result = await getMovementRows(1, " EGG ", "OUT");
    const expectedWhere = expect.objectContaining({
      type: "OUT",
      OR: expect.any(Array)
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
      lotNo: "LOT-001"
    })]);
  });
});
