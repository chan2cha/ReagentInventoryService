import { describe, expect, it } from "vitest";
import { buildLotWhere, buildMovementWhere } from "./export-filters";
import { lotStatusKindFromSnapshot } from "./lot-status";

describe("export query filters", () => {
  it("builds the shared LOT search predicate from a trimmed query", () => {
    expect(buildLotWhere({ q: "  EGG  " })).toEqual({
      OR: [
        { lotNo: { contains: "EGG", mode: "insensitive" } },
        { allergen: { is: { name: { contains: "EGG", mode: "insensitive" } } } },
        { allergen: { is: { code: { contains: "EGG", mode: "insensitive" } } } }
      ]
    });
    expect(buildLotWhere({ q: "   " })).toEqual({});

    const now = new Date("2026-07-13T03:00:00.000Z");
    expect(buildLotWhere({ q: " EGG ", status: "LOW_STOCK" }, now)).toEqual({
      AND: [
        expect.objectContaining({ OR: expect.any(Array) }),
        {
          expirationDate: { gte: new Date("2026-08-13T00:00:00.000Z") },
          currentQuantity: { not: 0 },
          allergen: { is: { minStock: { gt: 0 } } }
        }
      ]
    });
    expect(() => buildLotWhere({ status: "low" }, now)).toThrow("EXPORT_FILTER_STATUS_INVALID");

    expect([
      lotStatusKindFromSnapshot({ currentQuantity: 0, expirationDate: "2026-07-12", minStock: 5 }, now),
      lotStatusKindFromSnapshot({ currentQuantity: 0, expirationDate: "2026-07-13", minStock: 5 }, now),
      lotStatusKindFromSnapshot({ currentQuantity: 1, expirationDate: "2026-08-12", minStock: 5 }, now),
      lotStatusKindFromSnapshot({ currentQuantity: 1, expirationDate: "2026-08-13", minStock: 5 }, now),
      lotStatusKindFromSnapshot({ currentQuantity: 5, expirationDate: "2026-08-13", minStock: 5 }, now)
    ]).toEqual(["EXPIRED", "OUT_OF_STOCK", "EXPIRING", "LOW_STOCK", "NORMAL"]);
  });

  it("combines movement search, kind, and inclusive Korean calendar dates", () => {
    const where = buildMovementWhere({
      q: "  order-1 ",
      from: "2026-07-13",
      to: "2026-07-14",
      type: "OUT"
    });

    expect(where).toMatchObject({
      type: "OUT",
      createdAt: {
        gte: new Date("2026-07-12T15:00:00.000Z"),
        lt: new Date("2026-07-14T15:00:00.000Z")
      }
    });
    expect(where.OR).toHaveLength(4);
    expect(where.OR?.[0]).toEqual({
      reason: { contains: "order-1", mode: "insensitive" }
    });
  });

  it("supports independent from and through-date filters", () => {
    expect(buildMovementWhere({ from: "2026-01-01" })).toEqual({
      createdAt: { gte: new Date("2025-12-31T15:00:00.000Z") }
    });
    expect(buildMovementWhere({ to: "2026-01-01" })).toEqual({
      createdAt: { lt: new Date("2026-01-01T15:00:00.000Z") }
    });
  });

  it.each([
    [{ from: "2026-02-30" }, "EXPORT_FILTER_FROM_INVALID"],
    [{ to: "2026/02/20" }, "EXPORT_FILTER_TO_INVALID"],
    [{ type: "out" }, "EXPORT_FILTER_TYPE_INVALID"],
    [{ from: "2026-07-14", to: "2026-07-13" }, "EXPORT_FILTER_DATE_RANGE_INVALID"]
  ])("rejects an invalid movement filter", (filters, errorCode) => {
    expect(() => buildMovementWhere(filters)).toThrow(errorCode);
  });
});
