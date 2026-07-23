import { describe, expect, it } from "vitest";
import { buildMovementWhere, buildOrderWhere, buildWarehouseStockWhere } from "./export-filters";
import { lotStatusKindFromSnapshot } from "./lot-status";

describe("export query filters", () => {
  it("builds the shared LOT search predicate from a trimmed query", () => {
    expect(buildWarehouseStockWhere({ q: "  EGG  " })).toEqual({
      reagentLot: { is: { OR: [
        { lotNo: { contains: "EGG", mode: "insensitive" } },
        { allergen: { is: { name: { contains: "EGG", mode: "insensitive" } } } },
        { allergen: { is: { code: { contains: "EGG", mode: "insensitive" } } } }
      ] } }
    });
    expect(buildWarehouseStockWhere({ q: "   " })).toEqual({});

    const now = new Date("2026-07-13T03:00:00.000Z");
    expect(buildWarehouseStockWhere({
      q: " EGG ",
      status: "NORMAL",
      warehouse: "FINISHED_GOODS"
    }, now)).toEqual({
      AND: [
        { reagentLot: { is: { OR: expect.any(Array) } } },
        {
          quantity: { not: 0 },
          reagentLot: { is: {
            expirationDate: { gte: new Date("2026-08-13T00:00:00.000Z") }
          } }
        },
        { warehouse: "FINISHED_GOODS" }
      ]
    });
    expect(() => buildWarehouseStockWhere({ status: "low" }, now))
      .toThrow("EXPORT_FILTER_STATUS_INVALID");
    expect(() => buildWarehouseStockWhere({ warehouse: "finished" }, now))
      .toThrow("EXPORT_FILTER_WAREHOUSE_INVALID");

    expect([
      lotStatusKindFromSnapshot({ currentQuantity: 0, expirationDate: "2026-07-12" }, now),
      lotStatusKindFromSnapshot({ currentQuantity: 0, expirationDate: "2026-07-13" }, now),
      lotStatusKindFromSnapshot({ currentQuantity: 1, expirationDate: "2026-08-12" }, now),
      lotStatusKindFromSnapshot({ currentQuantity: 1, expirationDate: "2026-08-13" }, now),
      lotStatusKindFromSnapshot({ currentQuantity: 5, expirationDate: "2026-08-13" }, now)
    ]).toEqual(["EXPIRED", "OUT_OF_STOCK", "EXPIRING", "NORMAL", "NORMAL"]);
  });

  it("combines movement search, kind, and inclusive Korean calendar dates", () => {
    const where = buildMovementWhere({
      q: "  order-1 ",
      from: "2026-07-13",
      to: "2026-07-14",
      type: "OUT",
      warehouse: "FINISHED_GOODS"
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
    expect(where.AND).toEqual([{
      OR: [
        { warehouse: "FINISHED_GOODS" },
        { destinationWarehouse: "FINISHED_GOODS" }
      ]
    }]);
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
    [{ warehouse: "finished" }, "EXPORT_FILTER_WAREHOUSE_INVALID"],
    [{ from: "2026-07-14", to: "2026-07-13" }, "EXPORT_FILTER_DATE_RANGE_INVALID"]
  ])("rejects an invalid movement filter", (filters, errorCode) => {
    expect(() => buildMovementWhere(filters)).toThrow(errorCode);
  });

  it("builds an order search with inclusive Korean calendar dates", () => {
    const where = buildOrderWhere({
      q: " 서울 ",
      from: "2026-07-21",
      to: "2026-07-21"
    });

    expect(where.createdAt).toEqual({
      gte: new Date("2026-07-20T15:00:00.000Z"),
      lt: new Date("2026-07-21T15:00:00.000Z")
    });
    expect(where.OR).toHaveLength(6);
    expect(where.OR?.[0]).toEqual({
      orderNo: { contains: "서울", mode: "insensitive" }
    });
    expect(where.OR?.[4]).toEqual({
      items: {
        some: {
          allergen: {
            is: { name: { contains: "서울", mode: "insensitive" } }
          }
        }
      }
    });
  });

  it("rejects invalid order export dates", () => {
    expect(() => buildOrderWhere({ from: "2026-07-22", to: "2026-07-21" }))
      .toThrow("EXPORT_FILTER_DATE_RANGE_INVALID");
    expect(() => buildOrderWhere({ from: "2026-02-30" }))
      .toThrow("EXPORT_FILTER_FROM_INVALID");
  });
});
