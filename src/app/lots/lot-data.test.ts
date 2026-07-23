import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    warehouseStock: {
      count: mocks.count,
      findMany: mocks.findMany
    }
  }
}));

import { getLotRows } from "./lot-data";

function warehouseStock(id: string, currentQuantity: number, expirationDate: string, warehouse = "FINISHED_GOODS") {
  return {
    reagentLotId: id,
    warehouse,
    quantity: currentQuantity,
    reagentLot: {
      lotNo: `LOT-${id}`,
      receivedDate: new Date("2026-06-01T00:00:00.000Z"),
      expirationDate: new Date(`${expirationDate}T00:00:00.000Z`),
      allergen: { name: "Egg", code: "EGG-01" }
    }
  };
}

describe("getLotRows status filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries warehouse-stock rows for the selected status and warehouse", async () => {
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([warehouseStock("returned", 3, "2026-07-25", "RETURNED")]);

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
    expect(result.rows).toEqual([expect.objectContaining({
      id: "returned:RETURNED",
      lotId: "returned",
      warehouse: "RETURNED",
      currentQuantity: 3
    })]);
  });
});
