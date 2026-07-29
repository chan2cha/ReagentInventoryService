import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cancelPendingOrder } from "../services/order-service";
import { createOrderValue } from "../services/order-create-service";
import { processShipment, reverseShipment } from "../services/shipment-service";
import { adjustLotStockValue } from "../services/stock-service";
import { transferWarehouseStock } from "../services/warehouse-transfer-service";
import { completeReplacement, confirmReplacement } from "../services/replacement-service";
import {
  listLotExportRows,
  listMovementExportRows
} from "../services/export-data-service";

vi.mock("server-only", () => ({}));

const testUrl = process.env.TEST_DATABASE_URL;
const operationalUrls = [process.env.DATABASE_URL, process.env.DIRECT_URL]
  .filter((url): url is string => Boolean(url));

function target(url: string) {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const directProject = parsed.hostname.match(/^db\.([^.]+)\.supabase\.co$/i)?.[1];
  const pooledProject = decodeURIComponent(parsed.username)
    .match(/^postgres\.([A-Za-z0-9_-]+)$/i)?.[1];
  const project = directProject ?? pooledProject;
  const schema = parsed.searchParams.get("schema") ?? "public";

  // A different credential or pooler port can still point at the same database.
  // Compare the data target, not the connection identity, before allowing writes.
  return project
    ? `supabase:${project}/${database}?schema=${schema}`
    : `${parsed.hostname.toLowerCase()}/${database}?schema=${schema}`;
}

if (!testUrl) throw new Error("TEST_DATABASE_URL_REQUIRED");
if (operationalUrls.some((url) => target(testUrl) === target(url))) {
  throw new Error("TEST_DATABASE_MUST_BE_ISOLATED");
}

function createTestPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: testUrl })
  });
}

const prisma = createTestPrismaClient();
const concurrentPrisma = createTestPrismaClient();
const runId = `integration-${Date.now()}`;
const shipmentNow = new Date("2030-01-15T03:00:00.000Z");
let userId: string;
let allergenId: string;
let clientId: string;

async function createOrder(quantity: number) {
  return prisma.order.create({
    data: {
      orderNo: `${runId}-${crypto.randomUUID()}`,
      clientId,
      createdBy: userId,
      items: { create: { allergenId, quantity } }
    }
  });
}

async function createLot(data: {
  allergenId: string;
  lotNo: string;
  expirationDate: Date;
  receivedDate: Date;
  initialQuantity: number;
  currentQuantity: number;
  memo?: string;
}) {
  const { currentQuantity, ...lot } = data;
  return prisma.reagentLot.create({
    data: {
      ...lot,
      warehouseStocks: {
        create: {
          warehouse: "FINISHED_GOODS",
          quantity: currentQuantity
        }
      }
    }
  });
}

function finishedGoodsTotal() {
  return prisma.warehouseStock.aggregate({
    where: {
      warehouse: "FINISHED_GOODS",
      reagentLot: { is: { allergenId } }
    },
    _sum: { quantity: true }
  });
}

async function shippableStockTotal() {
  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    select: { code: true }
  });
  return prisma.warehouseStock.aggregate({
    where: {
      warehouse: { in: warehouses.map((warehouse) => warehouse.code) },
      reagentLot: { is: { allergenId } }
    },
    _sum: { quantity: true }
  });
}

async function finishedGoodsQuantity(lotId: string) {
  const stock = await prisma.warehouseStock.findUniqueOrThrow({
    where: {
      reagentLotId_warehouse: {
        reagentLotId: lotId,
        warehouse: "FINISHED_GOODS"
      }
    }
  });
  return stock.quantity;
}

describe("database transactions", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({ data: { loginId: runId, name: "Integration Test", passwordHash: "test", role: "ADMIN" } });
    const allergen = await prisma.allergen.create({ data: { code: runId.toUpperCase(), name: "Integration Reagent" } });
    const client = await prisma.client.create({ data: { name: runId } });
    userId = user.id;
    allergenId = allergen.id;
    clientId = client.id;
  });

  afterAll(async () => {
    try {
      if (userId) {
        await prisma.auditLog.deleteMany({ where: { actorId: userId } });
        await prisma.stockMovement.deleteMany({ where: { creator: { id: userId } } });
      }
      if (clientId) {
        await prisma.replacement.deleteMany({ where: { originalShipmentItem: { shipment: { order: { clientId } } } } });
        await prisma.order.updateMany({ where: { clientId }, data: { shortageFromShipmentId: null } });
        await prisma.shipmentItem.deleteMany({ where: { shipment: { order: { clientId } } } });
        await prisma.shipment.deleteMany({ where: { order: { clientId } } });
        await prisma.orderItem.deleteMany({ where: { order: { clientId } } });
        await prisma.order.deleteMany({ where: { clientId } });
      }
      if (allergenId) {
        await prisma.reagentLot.deleteMany({ where: { allergenId } });
        await prisma.allergen.deleteMany({ where: { id: allergenId } });
      }
      if (clientId) {
        await prisma.client.deleteMany({ where: { id: clientId } });
      }
      if (userId) {
        await prisma.user.deleteMany({ where: { id: userId } });
      }
    } finally {
      await concurrentPrisma.$disconnect();
      await prisma.$disconnect();
    }
  });

  it("allocates earliest-expiring lots and blocks duplicate shipment", async () => {
    const early = await createLot({ allergenId, lotNo: `${runId}-early`, expirationDate: new Date("2031-01-01"), receivedDate: new Date("2029-01-01"), initialQuantity: 2, currentQuantity: 2 });
    const later = await createLot({ allergenId, lotNo: `${runId}-later`, expirationDate: new Date("2032-01-01"), receivedDate: new Date("2029-01-01"), initialQuantity: 5, currentQuantity: 5 });
    const order = await createOrder(5);
    const shipment = await processShipment(prisma, order.id, userId, shipmentNow);
    expect(await prisma.shipmentItem.findMany({ where: { shipmentId: shipment.id }, orderBy: { reagentLot: { expirationDate: "asc" } }, select: { reagentLotId: true, quantity: true } })).toEqual([{ reagentLotId: early.id, quantity: 2 }, { reagentLotId: later.id, quantity: 3 }]);
    await expect(processShipment(prisma, order.id, userId, shipmentNow)).rejects.toThrow("ORDER_ALREADY_SHIPPED");
  });

  it("ships and restores the selected warehouse when one LOT has stock in multiple warehouses", async () => {
    const lot = await createLot({
      allergenId,
      lotNo: `${runId}-multi-warehouse`,
      expirationDate: new Date("2031-04-01"),
      receivedDate: new Date("2029-01-01"),
      initialQuantity: 5,
      currentQuantity: 2
    });
    await prisma.warehouseStock.create({
      data: {
        reagentLotId: lot.id,
        warehouse: "SAMPLE",
        quantity: 3
      }
    });
    const order = await createOrder(3);
    const shipment = await processShipment(
      prisma,
      order.id,
      userId,
      shipmentNow,
      [{ lotId: lot.id, warehouse: "SAMPLE", quantity: 3 }]
    );

    expect(await prisma.shipmentItem.findMany({
      where: { shipmentId: shipment.id },
      select: { reagentLotId: true, warehouse: true, quantity: true }
    })).toEqual([{ reagentLotId: lot.id, warehouse: "SAMPLE", quantity: 3 }]);
    expect(await prisma.warehouseStock.findUniqueOrThrow({
      where: {
        reagentLotId_warehouse: {
          reagentLotId: lot.id,
          warehouse: "FINISHED_GOODS"
        }
      },
      select: { quantity: true }
    })).toEqual({ quantity: 2 });
    expect(await prisma.warehouseStock.findUniqueOrThrow({
      where: {
        reagentLotId_warehouse: {
          reagentLotId: lot.id,
          warehouse: "SAMPLE"
        }
      },
      select: { quantity: true }
    })).toEqual({ quantity: 0 });

    await reverseShipment(prisma, shipment.id, userId, "창고별 복구 검증");

    expect(await prisma.warehouseStock.findUniqueOrThrow({
      where: {
        reagentLotId_warehouse: {
          reagentLotId: lot.id,
          warehouse: "SAMPLE"
        }
      },
      select: { quantity: true }
    })).toEqual({ quantity: 3 });
    expect(await prisma.stockMovement.findFirstOrThrow({
      where: {
        refType: "SHIPMENT_CANCEL",
        refId: shipment.id
      },
      select: { warehouse: true }
    })).toEqual({ warehouse: "SAMPLE" });
  });

  it("exports filtered inventory and resolves outbound movement references", async () => {
    const lotNo = `${runId}-export`;
    await createLot({
        allergenId,
        lotNo,
        expirationDate: new Date("2030-03-15"),
        receivedDate: new Date("2029-06-01"),
        initialQuantity: 2,
        currentQuantity: 2,
        memo: "엑셀 통합 테스트"
    });
    const order = await createOrder(1);
    await processShipment(prisma, order.id, userId, shipmentNow);

    const inventoryRows = await listLotExportRows(prisma, {
      q: lotNo,
      status: "NORMAL",
      now: shipmentNow
    });
    const movementRows = await listMovementExportRows(prisma, { q: lotNo });

    expect(inventoryRows).toEqual([
      expect.objectContaining({
        allergenCode: runId.toUpperCase(),
        lotNo,
        initialQuantity: 2,
        currentQuantity: 1,
        status: "정상",
        memo: "엑셀 통합 테스트"
      })
    ]);
    expect(movementRows).toEqual([
      expect.objectContaining({
        type: "OUT",
        rawQuantity: 1,
        deltaQuantity: -1,
        lotNo,
        orderNo: order.orderNo,
        clientName: runId,
        actorName: "Integration Test"
      })
    ]);
  });

  it("partially ships available stock and creates a shortage reorder", async () => {
    const order = await createOrder(10000);
    const before = await shippableStockTotal();
    await expect(
      processShipment(prisma, order.id, userId, shipmentNow)
    ).rejects.toThrow("PARTIAL_SHIPMENT_MEMO_REQUIRED");
    const shipment = await processShipment(
      prisma,
      order.id,
      userId,
      shipmentNow,
      undefined,
      "재고 부족으로 가용 수량 우선 출고"
    );
    const after = await shippableStockTotal();
    const shipmentItems = await prisma.shipmentItem.findMany({ where: { shipmentId: shipment.id } });
    const shippedQuantity = shipmentItems.reduce((sum, item) => sum + item.quantity, 0);
    const shortageOrder = await prisma.order.findUniqueOrThrow({
      where: { shortageFromShipmentId: shipment.id },
      include: { items: true }
    });

    expect(shipment.fulfillmentStatus).toBe("PARTIAL");
    expect(shippedQuantity).toBeGreaterThan(0);
    expect(after._sum.quantity).toBe((before._sum.quantity ?? 0) - shippedQuantity);
    expect(shortageOrder).toMatchObject({
      clientId,
      status: "RECEIVED",
      origin: "SHORTAGE_REORDER",
      createdBy: userId
    });
    expect(shortageOrder.items).toEqual([expect.objectContaining({ allergenId, quantity: 10000 - shippedQuantity })]);
    expect(await prisma.auditLog.count({ where: { action: "ORDER_CREATE_SHORTAGE_REORDER", entityId: shortageOrder.id } })).toBe(1);

    await reverseShipment(prisma, shipment.id, userId, "partial shipment reversal");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: shortageOrder.id } })).status).toBe("CANCELLED");
    expect((await shippableStockTotal())._sum.quantity).toBe(before._sum.quantity);
  });

  it("blocks original shipment cancellation after its shortage reorder is shipped", async () => {
    const selectedLot = await createLot({
      allergenId,
      lotNo: `${runId}-manual-partial`,
      expirationDate: new Date("2031-06-01"),
      receivedDate: new Date("2029-01-01"),
      initialQuantity: 1,
      currentQuantity: 1
    });
    const order = await createOrder(2);
    const originalShipment = await processShipment(
      prisma,
      order.id,
      userId,
      shipmentNow,
      [{ lotId: selectedLot.id, warehouse: "FINISHED_GOODS", quantity: 1 }],
      "대체 LOT 우선 출고"
    );
    expect(originalShipment.memo).toBe("수동 LOT 배정 출고 / 메모: 대체 LOT 우선 출고");
    expect(await prisma.auditLog.count({
      where: {
        action: "SHIPMENT_CREATE",
        entityId: originalShipment.id,
        description: { contains: "대체 LOT 우선 출고" }
      }
    })).toBe(1);
    const shortageOrder = await prisma.order.findUniqueOrThrow({
      where: { shortageFromShipmentId: originalShipment.id }
    });

    await processShipment(prisma, shortageOrder.id, userId, shipmentNow);
    const stockBeforeCancellation = await shippableStockTotal();

    await expect(
      reverseShipment(prisma, originalShipment.id, userId, "원출고 취소 시도")
    ).rejects.toThrow("SHORTAGE_REORDER_ALREADY_SHIPPED");

    expect(await prisma.shipment.findUniqueOrThrow({
      where: { id: originalShipment.id },
      select: { status: true }
    })).toEqual({ status: "SHIPPED" });
    expect((await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true }
    })).status).toBe("SHIPPED");
    expect((await shippableStockTotal())._sum.quantity).toBe(stockBeforeCancellation._sum.quantity);
  });

  it("restores lot quantities and order status when shipment is cancelled", async () => {
    const shipment = await prisma.shipment.findFirstOrThrow({ where: { order: { clientId }, status: "SHIPPED" }, include: { items: true } });
    await reverseShipment(prisma, shipment.id, userId, "통합 테스트");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: shipment.orderId } })).status).toBe("READY_TO_SHIP");
    expect((await prisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } })).status).toBe("CANCELLED");
    expect(await prisma.auditLog.count({ where: { action: "SHIPMENT_CANCEL", entityId: shipment.id } })).toBe(1);
  });

  it("excludes expired and future-received lots while allowing a lot through its expiration day", async () => {
    const expired = await createLot({
        allergenId,
        lotNo: `${runId}-expired`,
        expirationDate: new Date("2030-01-14"),
        receivedDate: new Date("2029-01-01"),
        initialQuantity: 3,
        currentQuantity: 3
    });
    const expiresToday = await createLot({
        allergenId,
        lotNo: `${runId}-expires-today`,
        expirationDate: new Date("2030-01-15"),
        receivedDate: new Date("2029-01-01"),
        initialQuantity: 2,
        currentQuantity: 2
    });
    const futureReceived = await createLot({
        allergenId,
        lotNo: `${runId}-future-received`,
        expirationDate: new Date("2030-02-01"),
        receivedDate: new Date("2030-01-16"),
        initialQuantity: 3,
        currentQuantity: 3
    });
    const order = await createOrder(2);

    const shipment = await processShipment(prisma, order.id, userId, shipmentNow);

    expect(await prisma.shipmentItem.findMany({
      where: {
        shipmentId: shipment.id
      },
      select: {
        reagentLotId: true,
        quantity: true
      }
    })).toEqual([{ reagentLotId: expiresToday.id, quantity: 2 }]);
    expect(await finishedGoodsQuantity(expired.id)).toBe(3);
    expect(await finishedGoodsQuantity(futureReceived.id)).toBe(3);
  });

  it("serializes duplicate shipment and duplicate reversal requests", async () => {
    const order = await createOrder(1);
    const before = await shippableStockTotal();
    const shipmentResults = await Promise.allSettled([
      processShipment(prisma, order.id, userId, shipmentNow),
      processShipment(concurrentPrisma, order.id, userId, shipmentNow)
    ]);

    expect(shipmentResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(shipmentResults.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.shipment.count({ where: { orderId: order.id, status: "SHIPPED" } })).toBe(1);
    expect((await shippableStockTotal())._sum.quantity).toBe((before._sum.quantity ?? 0) - 1);

    const shipment = await prisma.shipment.findFirstOrThrow({
      where: {
        orderId: order.id,
        status: "SHIPPED"
      }
    });
    const reversalResults = await Promise.allSettled([
      reverseShipment(prisma, shipment.id, userId, "동시 취소 1"),
      reverseShipment(concurrentPrisma, shipment.id, userId, "동시 취소 2")
    ]);

    expect(reversalResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(reversalResults.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await shippableStockTotal())._sum.quantity).toBe(before._sum.quantity);
    expect(await prisma.stockMovement.count({
      where: {
        refType: "SHIPMENT_CANCEL",
        refId: shipment.id
      }
    })).toBe(1);
  });

  it("keeps order cancellation and shipment mutually exclusive under contention", async () => {
    const order = await createOrder(1);
    const before = await shippableStockTotal();
    const results = await Promise.allSettled([
      processShipment(prisma, order.id, userId, shipmentNow),
      cancelPendingOrder(concurrentPrisma, order.id, userId, "동시 주문 취소")
    ]);
    const savedOrder = await prisma.order.findUniqueOrThrow({
      where: {
        id: order.id
      }
    });
    const activeShipmentCount = await prisma.shipment.count({
      where: {
        orderId: order.id,
        status: "SHIPPED"
      }
    });
    const after = await shippableStockTotal();

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    if (savedOrder.status === "SHIPPED") {
      expect(activeShipmentCount).toBe(1);
      expect(after._sum.quantity).toBe((before._sum.quantity ?? 0) - 1);
    } else {
      expect(savedOrder.status).toBe("CANCELLED");
      expect(activeShipmentCount).toBe(0);
      expect(after._sum.quantity).toBe(before._sum.quantity);
    }
  });

  it("uses a conditional decrement to prevent concurrent adjustments from making stock negative", async () => {
    const lot = await createLot({
        allergenId,
        lotNo: `${runId}-adjustment-race`,
        expirationDate: new Date("2030-03-01"),
        receivedDate: new Date("2029-01-01"),
        initialQuantity: 1,
        currentQuantity: 1
    });
    const input = {
      lotId: lot.id,
      quantity: -1,
      type: "ADJUST" as const,
      reason: "동시 조정 테스트",
      actorId: userId
    };
    const results = await Promise.allSettled([
      adjustLotStockValue(prisma, input),
      adjustLotStockValue(concurrentPrisma, input)
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await finishedGoodsQuantity(lot.id)).toBe(0);
    expect(await prisma.stockMovement.count({
      where: {
        refType: "STOCK_ADJUSTMENT",
        refId: lot.id
      }
    })).toBe(1);
  });

  it("rejects duplicate reagent lots", async () => {
    const data = { allergenId, lotNo: runId, expirationDate: new Date("2030-01-01"), receivedDate: new Date("2029-01-01"), initialQuantity: 10, currentQuantity: 10 };
    await createLot(data);
    const duplicateLot = {
      allergenId: data.allergenId,
      lotNo: data.lotNo,
      expirationDate: data.expirationDate,
      receivedDate: data.receivedDate,
      initialQuantity: data.initialQuantity
    };
    await expect(prisma.reagentLot.create({ data: duplicateLot })).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects an order that references an inactive reagent", async () => {
    await prisma.allergen.update({
      where: { id: allergenId },
      data: { isActive: false }
    });

    try {
      const orderCountBefore = await prisma.order.count({ where: { clientId } });
      const orderAuditCountBefore = await prisma.auditLog.count({
        where: { actorId: userId, action: "ORDER_CREATE" }
      });

      await expect(createOrderValue(prisma, {
        clientId,
        memo: "inactive reagent order",
        items: [{ allergenId, quantity: 1 }],
        actorId: userId,
        now: new Date("2099-12-30T03:00:00.000Z")
      })).rejects.toThrow("ALLERGEN_NOT_FOUND");

      expect(await prisma.order.count({ where: { clientId } })).toBe(orderCountBefore);
      expect(await prisma.auditLog.count({
        where: { actorId: userId, action: "ORDER_CREATE" }
      })).toBe(orderAuditCountBefore);
    } finally {
      await prisma.allergen.update({
        where: { id: allergenId },
        data: { isActive: true }
      });
    }
  });

  it("moves a partial LOT quantity between warehouses without changing the total", async () => {
    const lot = await createLot({
      allergenId,
      lotNo: `${runId}-warehouse-transfer`,
      expirationDate: new Date("2031-06-01"),
      receivedDate: new Date("2029-01-01"),
      initialQuantity: 12,
      currentQuantity: 10
    });
    await prisma.warehouseStock.create({
      data: {
        reagentLotId: lot.id,
        warehouse: "RETURNED",
        quantity: 2
      }
    });

    const totalBefore = (await prisma.warehouseStock.aggregate({
      where: { reagentLotId: lot.id },
      _sum: { quantity: true }
    }))._sum.quantity;

    await transferWarehouseStock(prisma, {
      lotId: lot.id,
      sourceWarehouse: "FINISHED_GOODS",
      destinationWarehouse: "RETURNED",
      quantity: 3,
      reason: "반품 창고 분리",
      actorId: userId
    });

    const balances = await prisma.warehouseStock.findMany({
      where: { reagentLotId: lot.id },
      orderBy: { warehouse: "asc" }
    });
    expect(balances.map((balance) => [balance.warehouse, balance.quantity]))
      .toEqual([["FINISHED_GOODS", 7], ["RETURNED", 5]]);
    expect(balances.reduce((total, balance) => total + balance.quantity, 0)).toBe(totalBefore);
    expect(await prisma.stockMovement.count({
      where: {
        reagentLotId: lot.id,
        type: "TRANSFER",
        warehouse: "FINISHED_GOODS",
        destinationWarehouse: "RETURNED",
        quantity: 3
      }
    })).toBe(1);
    expect(await prisma.auditLog.count({
      where: { actorId: userId, action: "STOCK_TRANSFER" }
    })).toBeGreaterThan(0);
  });

  it("allocates distinct order numbers for concurrent order creation", async () => {
    const now = new Date("2099-12-31T03:00:00.000Z");
    const input = {
      clientId,
      memo: "동시 주문 등록 통합 테스트",
      items: [{ allergenId, quantity: 1 }],
      actorId: userId,
      now
    };

    const [first, second] = await Promise.all([
      createOrderValue(prisma, input),
      createOrderValue(concurrentPrisma, input)
    ]);

    expect(new Set([first.orderNo, second.orderNo]).size).toBe(2);
    expect(first.orderNo).toMatch(/^ORD-20991231-\d{3}$/);
    expect(second.orderNo).toMatch(/^ORD-20991231-\d{3}$/);
    expect(await prisma.auditLog.count({
      where: {
        actorId: userId,
        action: "ORDER_CREATE",
        entityId: {
          in: [first.id, second.id]
        }
      }
    })).toBe(2);
  });

  it("rolls back stock and audit writes when a transaction fails", async () => {
    const stock = await prisma.warehouseStock.findFirstOrThrow({
      where: {
        warehouse: "FINISHED_GOODS",
        quantity: { gt: 0 },
        reagentLot: { is: { allergenId } }
      }
    });
    const beforeQuantity = stock.quantity;
    await expect(prisma.$transaction(async (tx) => {
      await tx.warehouseStock.update({
        where: { reagentLotId_warehouse: {
          reagentLotId: stock.reagentLotId,
          warehouse: stock.warehouse
        } },
        data: { quantity: { decrement: 1 } }
      });
      await tx.auditLog.create({ data: { action: "TEST_ROLLBACK", entityType: "LOT", entityId: stock.reagentLotId, description: "rollback", actorId: userId } });
      throw new Error("ROLLBACK");
    })).rejects.toThrow("ROLLBACK");
    expect(await finishedGoodsQuantity(stock.reagentLotId)).toBe(beforeQuantity);
    expect(await prisma.auditLog.count({ where: { action: "TEST_ROLLBACK", actorId: userId } })).toBe(0);
  });

  it("confirms a proactive replacement and ships eligible replacement stock", async () => {
    const originalLot = await createLot({ allergenId, lotNo: `${runId}-replacement-original`, expirationDate: new Date("2030-03-01"), receivedDate: new Date("2029-01-01"), initialQuantity: 2, currentQuantity: 0 });
    await createLot({ allergenId, lotNo: `${runId}-replacement-new`, expirationDate: new Date("2031-01-01"), receivedDate: new Date("2029-01-01"), initialQuantity: 2, currentQuantity: 2 });
    const order = await createOrder(2);
    await prisma.order.update({ where: { id: order.id }, data: { status: "SHIPPED" } });
    const shipment = await prisma.shipment.create({ data: { orderId: order.id, shippedBy: userId, purpose: "ORDER" } });
    const originalItem = await prisma.shipmentItem.create({ data: { shipmentId: shipment.id, reagentLotId: originalLot.id, allergenId, quantity: 2 } });

    const replacement = await confirmReplacement(prisma, { shipmentItemId: originalItem.id, quantity: 1, actorId: userId, now: shipmentNow });
    const completed = await completeReplacement(prisma, { replacementId: replacement.id, disposition: "CLIENT_DISPOSED", actorId: userId, now: shipmentNow });

    expect(completed).toMatchObject({ status: "COMPLETED", confirmedQuantity: 1, returnDisposition: "CLIENT_DISPOSED" });
    expect(await prisma.shipment.findUniqueOrThrow({ where: { id: completed.replacementShipmentId! } })).toMatchObject({ purpose: "REPLACEMENT", status: "SHIPPED" });
    expect(await prisma.stockMovement.count({ where: { refType: "REPLACEMENT", refId: replacement.id, type: "OUT" } })).toBeGreaterThan(0);
  });
});
