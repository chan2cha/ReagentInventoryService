import { describe, expect, it } from "vitest";

type Lot = {
  id: string;
  expirationDate: Date;
  currentQuantity: number;
};

function allocateFefo(lots: Lot[], requestedQuantity: number) {
  let remaining = requestedQuantity;

  return lots
    .filter((lot) => lot.currentQuantity > 0)
    .sort((a, b) => a.expirationDate.getTime() - b.expirationDate.getTime())
    .flatMap((lot) => {
      if (remaining <= 0) {
        return [];
      }

      const quantity = Math.min(lot.currentQuantity, remaining);
      remaining -= quantity;

      return [{ lotId: lot.id, quantity }];
    });
}

describe("allocateFefo", () => {
  it("allocates earlier expiration lots first", () => {
    const allocations = allocateFefo(
      [
        {
          id: "EGG-002",
          expirationDate: new Date("2027-01-31"),
          currentQuantity: 10
        },
        {
          id: "EGG-001",
          expirationDate: new Date("2026-09-30"),
          currentQuantity: 5
        }
      ],
      7
    );

    expect(allocations).toEqual([
      { lotId: "EGG-001", quantity: 5 },
      { lotId: "EGG-002", quantity: 2 }
    ]);
  });
});
