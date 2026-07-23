import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  EXPORT_QUERY_TAKE,
  EXPORT_ROW_LIMIT,
  ExportRowLimitExceededError,
  listLotExportRows,
  listMovementExportRows,
  listOrderExportRows
} from "./export-data-service";

function dbMock(delegates: Record<string, unknown>) {
  return delegates as unknown as PrismaClient;
}

function lotRecord(overrides: Record<string, unknown> = {}) {
  return {
    warehouse: "FINISHED_GOODS",
    quantity: 2,
    reagentLot: {
      id: "lot-1",
      lotNo: "LOT-EGG-001",
      receivedDate: new Date("2026-01-10T00:00:00.000Z"),
      expirationDate: new Date("2026-08-20T00:00:00.000Z"),
      memo: "냉장 보관",
      isActive: true,
      allergen: {
        code: "EGG-01",
        name: "난백",
        category: "식품성"
      }
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
    warehouse: "FINISHED_GOODS",
    destinationWarehouse: null,
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

function orderItemRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    quantity: 3,
    allergen: {
      code: "EGG-01",
      name: "난백"
    },
    order: {
      id: "order-1",
      createdAt: new Date("2026-07-21T01:30:00.000Z"),
      orderNo: "ORD-20260721-001",
      status: "CANCELLED",
      memo: "=HYPERLINK(\"bad\")",
      client: {
        name: "서울병원",
        managerName: "김담당"
      },
      creator: {
        name: "주문 담당자"
      },
      image: { id: "image-1" }
    },
    ...overrides
  };
}

describe("export data service", () => {
  it("loads lean, stable LOT rows and computes their snapshot status", async () => {
    const findMany = vi.fn().mockResolvedValue([lotRecord()]);
    const db = dbMock({ warehouseStock: { findMany } });

    const rows = await listLotExportRows(db, {
      q: " EGG ",
      warehouse: "FINISHED_GOODS",
      now: new Date("2026-07-13T03:00:00.000Z")
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: EXPORT_QUERY_TAKE,
      orderBy: [
        { reagentLot: { expirationDate: "asc" } },
        { reagentLot: { lotNo: "asc" } },
        { warehouse: "asc" },
        { reagentLotId: "asc" }
      ],
      where: expect.objectContaining({ AND: expect.any(Array) }),
      select: expect.objectContaining({
        warehouse: true,
        quantity: true,
        reagentLot: expect.objectContaining({
          select: expect.objectContaining({
            lotNo: true,
            allergen: expect.any(Object)
          })
        })
      })
    }));
    expect(rows).toEqual([{
      allergenCode: "EGG-01",
      allergenName: "난백",
      category: "식품성",
      lotNo: "LOT-EGG-001",
      receivedDate: new Date("2026-01-10T00:00:00.000Z"),
      expirationDate: new Date("2026-08-20T00:00:00.000Z"),
      warehouse: "FINISHED_GOODS",
      currentQuantity: 2,
      status: "정상",
      isActive: true,
      memo: "냉장 보관"
    }]);
  });

  it("exports rows that match an ordinary inventory status", async () => {
    const findMany = vi.fn().mockResolvedValue([lotRecord()]);
    const queryRaw = vi.fn();
    const db = dbMock({ $queryRaw: queryRaw, warehouseStock: { findMany } });

    const rows = await listLotExportRows(db, {
      q: "EGG",
      status: "NORMAL",
      warehouse: "FINISHED_GOODS",
      now: new Date("2026-07-13T03:00:00.000Z")
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      lotNo: "LOT-EGG-001",
      warehouse: "FINISHED_GOODS",
      status: "정상"
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
      }),
      movementRecord({
        id: "movement-3",
        type: "TRANSFER",
        quantity: 2,
        warehouse: "RETURNED",
        destinationWarehouse: "NONCONFORMING",
        refType: "WAREHOUSE_TRANSFER",
        refId: null
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
      type: "OUT",
      warehouse: "FINISHED_GOODS"
    });

    expect(stockMovementFindMany).toHaveBeenCalledWith(expect.objectContaining({
      take: EXPORT_QUERY_TAKE,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ],
      where: {
        type: "OUT",
        AND: [{
          OR: [
            { warehouse: "FINISHED_GOODS" },
            { destinationWarehouse: "FINISHED_GOODS" }
          ]
        }],
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
      actorName: row.actorName,
      warehouse: row.warehouse,
      destinationWarehouse: row.destinationWarehouse
    }))).toEqual([
      {
        type: "OUT",
        label: "출고",
        raw: 7,
        delta: -7,
        orderNo: "ORD-20260713-001",
        clientName: "서울병원",
        actorName: "출고 담당자",
        warehouse: "FINISHED_GOODS",
        destinationWarehouse: null
      },
      {
        type: "REVERSE",
        label: "출고취소/복구",
        raw: 7,
        delta: 7,
        orderNo: "ORD-20260713-001",
        clientName: "서울병원",
        actorName: "출고 담당자",
        warehouse: "FINISHED_GOODS",
        destinationWarehouse: null
      },
      {
        type: "TRANSFER",
        label: "창고이동",
        raw: 2,
        delta: 0,
        orderNo: null,
        clientName: null,
        actorName: "출고 담당자",
        warehouse: "RETURNED",
        destinationWarehouse: "NONCONFORMING"
      }
    ]);
  });

  it("exports every item of matched orders using a lean relation select and KST dates", async () => {
    const findMany = vi.fn().mockResolvedValue([
      orderItemRecord(),
      orderItemRecord({
        id: "item-2",
        quantity: 1,
        allergen: { code: "MILK-01", name: "우유" }
      })
    ]);
    const db = dbMock({ orderItem: { findMany } });

    const rows = await listOrderExportRows(db, {
      q: " 서울 ",
      from: "2026-07-21",
      to: "2026-07-21"
    });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: EXPORT_QUERY_TAKE,
      orderBy: [
        { order: { createdAt: "desc" } },
        { order: { id: "desc" } },
        { id: "asc" }
      ],
      where: {
        order: {
          is: expect.objectContaining({
            OR: expect.any(Array),
            createdAt: {
              gte: new Date("2026-07-20T15:00:00.000Z"),
              lt: new Date("2026-07-21T15:00:00.000Z")
            }
          })
        }
      }
    }));
    const select = findMany.mock.calls[0][0].select;
    expect(select.order.select.image.select).toEqual({ id: true });
    expect(select.order.select.image.select).not.toHaveProperty("data");
    expect(select.order.select.client.select).toEqual({ name: true, managerName: true });
    expect(rows).toEqual([
      expect.objectContaining({
        orderId: "order-1",
        orderNo: "ORD-20260721-001",
        status: "취소",
        allergenCode: "EGG-01",
        quantity: 3,
        hasImage: true
      }),
      expect.objectContaining({ allergenCode: "MILK-01", quantity: 1 })
    ]);
  });

  it.each([
    ["lots", "warehouseStock"],
    ["movements", "stockMovement"],
    ["orders", "orderItem"]
  ] as const)("rejects %s exports above the sheet row limit", async (dataset, delegateName) => {
    const findMany = vi.fn().mockResolvedValue(
      Array.from({ length: EXPORT_ROW_LIMIT + 1 }, () => (
        dataset === "lots"
          ? lotRecord()
          : dataset === "movements"
            ? movementRecord({ refType: null, refId: null })
            : orderItemRecord()
      ))
    );
    const db = dbMock({
      [delegateName]: { findMany },
      shipment: { findMany: vi.fn() }
    });

    const operation = dataset === "lots"
      ? listLotExportRows(db)
      : dataset === "movements"
        ? listMovementExportRows(db)
        : listOrderExportRows(db);

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
      warehouseStock: {
        findMany: vi.fn().mockRejectedValue(databaseError)
      }
    });

    await expect(listLotExportRows(db)).rejects.toBe(databaseError);
  });
});
