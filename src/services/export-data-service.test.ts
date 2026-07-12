import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  EXPORT_QUERY_TAKE,
  EXPORT_ROW_LIMIT,
  ExportRowLimitExceededError,
  listLotExportRows,
  listMovementExportRows
} from "./export-data-service";

function dbMock(delegates: Record<string, unknown>) {
  return delegates as unknown as PrismaClient;
}

function lotRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "lot-1",
    lotNo: "LOT-EGG-001",
    receivedDate: new Date("2026-01-10T00:00:00.000Z"),
    expirationDate: new Date("2026-08-20T00:00:00.000Z"),
    initialQuantity: 10,
    currentQuantity: 2,
    memo: "냉장 보관",
    isActive: true,
    allergen: {
      code: "EGG-01",
      name: "난백",
      category: "식품성",
      minStock: 5
    },
    ...overrides
  };
}

function movementRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "movement-1",
    createdAt: new Date("2026-07-13T01:23:45.000Z"),
    type: "OUT",
    quantity: 7,
    reason: "ORD-20260713-001",
    refType: "SHIPMENT",
    refId: "shipment-1",
    creator: {
      name: "출고 담당자"
    },
    reagentLot: {
      lotNo: "LOT-EGG-001",
      expirationDate: new Date("2026-08-20T00:00:00.000Z"),
      allergen: {
        code: "EGG-01",
        name: "난백"
      }
    },
    ...overrides
  };
}

describe("export data service", () => {
  it("loads lean, stable LOT rows and computes their snapshot status", async () => {
    const findMany = vi.fn().mockResolvedValue([lotRecord()]);
    const db = dbMock({ reagentLot: { findMany } });

    const rows = await listLotExportRows(db, {
      q: " EGG ",
      now: new Date("2026-07-13T03:00:00.000Z")
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: EXPORT_QUERY_TAKE,
      orderBy: [
        { expirationDate: "asc" },
        { lotNo: "asc" },
        { id: "asc" }
      ],
      where: expect.objectContaining({ OR: expect.any(Array) }),
      select: expect.objectContaining({
        lotNo: true,
        currentQuantity: true,
        allergen: {
          select: {
            code: true,
            name: true,
            category: true,
            minStock: true
          }
        }
      })
    }));
    expect(rows).toEqual([{
      allergenCode: "EGG-01",
      allergenName: "난백",
      category: "식품성",
      lotNo: "LOT-EGG-001",
      receivedDate: new Date("2026-01-10T00:00:00.000Z"),
      expirationDate: new Date("2026-08-20T00:00:00.000Z"),
      initialQuantity: 10,
      currentQuantity: 2,
      minStock: 5,
      status: "재고부족",
      isActive: true,
      memo: "냉장 보관"
    }]);
  });

  it("exports only rows that exactly match a computed inventory status", async () => {
    const findMany = vi.fn().mockResolvedValue([
      lotRecord(),
      lotRecord({
        id: "lot-2",
        lotNo: "LOT-EGG-002",
        currentQuantity: 8
      })
    ]);
    const db = dbMock({ reagentLot: { findMany } });

    const rows = await listLotExportRows(db, {
      q: "EGG",
      status: "LOW_STOCK",
      now: new Date("2026-07-13T03:00:00.000Z")
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.any(Array) }),
      take: 1_000
    }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      lotNo: "LOT-EGG-001",
      status: "재고부족"
    });
  });

  it("resolves shipment references and presents raw and effective movement quantities", async () => {
    const stockMovementFindMany = vi.fn().mockResolvedValue([
      movementRecord(),
      movementRecord({
        id: "movement-2",
        type: "REVERSE",
        quantity: 7,
        refType: "SHIPMENT_CANCEL"
      })
    ]);
    const shipmentFindMany = vi.fn().mockResolvedValue([{
      id: "shipment-1",
      order: {
        orderNo: "ORD-20260713-001",
        client: {
          name: "서울병원"
        }
      }
    }]);
    const db = dbMock({
      stockMovement: { findMany: stockMovementFindMany },
      shipment: { findMany: shipmentFindMany }
    });

    const rows = await listMovementExportRows(db, {
      from: "2026-07-13",
      to: "2026-07-13",
      type: "OUT"
    });

    expect(stockMovementFindMany).toHaveBeenCalledWith(expect.objectContaining({
      take: EXPORT_QUERY_TAKE,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ],
      where: {
        type: "OUT",
        createdAt: {
          gte: new Date("2026-07-12T15:00:00.000Z"),
          lt: new Date("2026-07-13T15:00:00.000Z")
        }
      }
    }));
    expect(shipmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["shipment-1"] } }
    }));
    expect(rows.map((row) => ({
      type: row.type,
      label: row.typeLabel,
      raw: row.rawQuantity,
      delta: row.deltaQuantity,
      orderNo: row.orderNo,
      clientName: row.clientName,
      actorName: row.actorName
    }))).toEqual([
      {
        type: "OUT",
        label: "출고",
        raw: 7,
        delta: -7,
        orderNo: "ORD-20260713-001",
        clientName: "서울병원",
        actorName: "출고 담당자"
      },
      {
        type: "REVERSE",
        label: "출고취소/복구",
        raw: 7,
        delta: 7,
        orderNo: "ORD-20260713-001",
        clientName: "서울병원",
        actorName: "출고 담당자"
      }
    ]);
  });

  it.each([
    ["lots", "reagentLot"],
    ["movements", "stockMovement"]
  ] as const)("rejects %s exports above the sheet row limit", async (dataset, delegateName) => {
    const findMany = vi.fn().mockResolvedValue(
      Array.from({ length: EXPORT_ROW_LIMIT + 1 }, () => (
        dataset === "lots" ? lotRecord() : movementRecord({ refType: null, refId: null })
      ))
    );
    const db = dbMock({
      [delegateName]: { findMany },
      shipment: { findMany: vi.fn() }
    });

    const operation = dataset === "lots"
      ? listLotExportRows(db)
      : listMovementExportRows(db);

    await expect(operation).rejects.toMatchObject({
      name: "ExportRowLimitExceededError",
      code: "EXPORT_ROW_LIMIT_EXCEEDED",
      dataset,
      limit: EXPORT_ROW_LIMIT
    });
    await expect(operation).rejects.toBeInstanceOf(ExportRowLimitExceededError);
  });

  it("propagates database errors instead of substituting sample data", async () => {
    const databaseError = new Error("database unavailable");
    const db = dbMock({
      reagentLot: {
        findMany: vi.fn().mockRejectedValue(databaseError)
      }
    });

    await expect(listLotExportRows(db)).rejects.toBe(databaseError);
  });
});
