import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cancelPendingOrder } from "../services/order-service";
import { createOrderValue } from "../services/order-create-service";
import {
  createOrderTemplate,
  listActiveOrderTemplates,
  setOrderTemplateActive,
  updateOrderTemplate
} from "../services/order-template-service";
import { processShipment, reverseShipment } from "../services/shipment-service";
import { adjustLotStockValue } from "../services/stock-service";
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

const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
const concurrentPrisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
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
        await prisma.orderTemplate.deleteMany({ where: { createdBy: userId } });
      }
      if (clientId) {
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
    const early = await prisma.reagentLot.create({ data: { allergenId, lotNo: `${runId}-early`, expirationDate: new Date("2031-01-01"), receivedDate: new Date("2029-01-01"), initialQuantity: 2, currentQuantity: 2 } });
    const later = await prisma.reagentLot.create({ data: { allergenId, lotNo: `${runId}-later`, expirationDate: new Date("2032-01-01"), receivedDate: new Date("2029-01-01"), initialQuantity: 5, currentQuantity: 5 } });
    const order = await createOrder(5);
    const shipment = await processShipment(prisma, order.id, userId, shipmentNow);
    expect(await prisma.shipmentItem.findMany({ where: { shipmentId: shipment.id }, orderBy: { reagentLot: { expirationDate: "asc" } }, select: { reagentLotId: true, quantity: true } })).toEqual([{ reagentLotId: early.id, quantity: 2 }, { reagentLotId: later.id, quantity: 3 }]);
    await expect(processShipment(prisma, order.id, userId, shipmentNow)).rejects.toThrow("ORDER_ALREADY_SHIPPED");
  });

  it("exports filtered inventory and resolves outbound movement references", async () => {
    const lotNo = `${runId}-export`;
    await prisma.reagentLot.create({
      data: {
        allergenId,
        lotNo,
        expirationDate: new Date("2030-03-15"),
        receivedDate: new Date("2029-06-01"),
        initialQuantity: 2,
        currentQuantity: 2,
        memo: "엑셀 통합 테스트"
      }
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

  it("rolls back an insufficient shipment without stock or audit changes", async () => {
    const order = await createOrder(10000);
    const before = await prisma.reagentLot.aggregate({ where: { allergenId }, _sum: { currentQuantity: true } });
    const auditCountBefore = await prisma.auditLog.count({
      where: {
        action: "SHIPMENT_CREATE",
        actorId: userId
      }
    });
    await expect(processShipment(prisma, order.id, userId, shipmentNow)).rejects.toThrow("INSUFFICIENT_STOCK");
    const after = await prisma.reagentLot.aggregate({ where: { allergenId }, _sum: { currentQuantity: true } });
    expect(after._sum.currentQuantity).toBe(before._sum.currentQuantity);
    expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "SHIPMENT_CREATE", actorId: userId } })).toBe(auditCountBefore);
  });

  it("restores lot quantities and order status when shipment is cancelled", async () => {
    const shipment = await prisma.shipment.findFirstOrThrow({ where: { order: { clientId }, status: "SHIPPED" }, include: { items: true } });
    await reverseShipment(prisma, shipment.id, userId, "통합 테스트");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: shipment.orderId } })).status).toBe("READY_TO_SHIP");
    expect((await prisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } })).status).toBe("CANCELLED");
    expect(await prisma.auditLog.count({ where: { action: "SHIPMENT_CANCEL", entityId: shipment.id } })).toBe(1);
  });

  it("excludes expired and future-received lots while allowing a lot through its expiration day", async () => {
    const expired = await prisma.reagentLot.create({
      data: {
        allergenId,
        lotNo: `${runId}-expired`,
        expirationDate: new Date("2030-01-14"),
        receivedDate: new Date("2029-01-01"),
        initialQuantity: 3,
        currentQuantity: 3
      }
    });
    const expiresToday = await prisma.reagentLot.create({
      data: {
        allergenId,
        lotNo: `${runId}-expires-today`,
        expirationDate: new Date("2030-01-15"),
        receivedDate: new Date("2029-01-01"),
        initialQuantity: 2,
        currentQuantity: 2
      }
    });
    const futureReceived = await prisma.reagentLot.create({
      data: {
        allergenId,
        lotNo: `${runId}-future-received`,
        expirationDate: new Date("2030-02-01"),
        receivedDate: new Date("2030-01-16"),
        initialQuantity: 3,
        currentQuantity: 3
      }
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
    expect((await prisma.reagentLot.findUniqueOrThrow({ where: { id: expired.id } })).currentQuantity).toBe(3);
    expect((await prisma.reagentLot.findUniqueOrThrow({ where: { id: futureReceived.id } })).currentQuantity).toBe(3);
  });

  it("serializes duplicate shipment and duplicate reversal requests", async () => {
    const order = await createOrder(1);
    const before = await prisma.reagentLot.aggregate({
      where: {
        allergenId
      },
      _sum: {
        currentQuantity: true
      }
    });
    const shipmentResults = await Promise.allSettled([
      processShipment(prisma, order.id, userId, shipmentNow),
      processShipment(concurrentPrisma, order.id, userId, shipmentNow)
    ]);

    expect(shipmentResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(shipmentResults.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.shipment.count({ where: { orderId: order.id, status: "SHIPPED" } })).toBe(1);
    expect((await prisma.reagentLot.aggregate({ where: { allergenId }, _sum: { currentQuantity: true } }))._sum.currentQuantity).toBe((before._sum.currentQuantity ?? 0) - 1);

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
    expect((await prisma.reagentLot.aggregate({ where: { allergenId }, _sum: { currentQuantity: true } }))._sum.currentQuantity).toBe(before._sum.currentQuantity);
    expect(await prisma.stockMovement.count({
      where: {
        refType: "SHIPMENT_CANCEL",
        refId: shipment.id
      }
    })).toBe(1);
  });

  it("keeps order cancellation and shipment mutually exclusive under contention", async () => {
    const order = await createOrder(1);
    const before = await prisma.reagentLot.aggregate({
      where: {
        allergenId
      },
      _sum: {
        currentQuantity: true
      }
    });
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
    const after = await prisma.reagentLot.aggregate({
      where: {
        allergenId
      },
      _sum: {
        currentQuantity: true
      }
    });

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    if (savedOrder.status === "SHIPPED") {
      expect(activeShipmentCount).toBe(1);
      expect(after._sum.currentQuantity).toBe((before._sum.currentQuantity ?? 0) - 1);
    } else {
      expect(savedOrder.status).toBe("CANCELLED");
      expect(activeShipmentCount).toBe(0);
      expect(after._sum.currentQuantity).toBe(before._sum.currentQuantity);
    }
  });

  it("uses a conditional decrement to prevent concurrent adjustments from making stock negative", async () => {
    const lot = await prisma.reagentLot.create({
      data: {
        allergenId,
        lotNo: `${runId}-adjustment-race`,
        expirationDate: new Date("2030-03-01"),
        receivedDate: new Date("2029-01-01"),
        initialQuantity: 1,
        currentQuantity: 1
      }
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
    expect((await prisma.reagentLot.findUniqueOrThrow({ where: { id: lot.id } })).currentQuantity).toBe(0);
    expect(await prisma.stockMovement.count({
      where: {
        refType: "STOCK_ADJUSTMENT",
        refId: lot.id
      }
    })).toBe(1);
  });

  it("rejects duplicate reagent lots", async () => {
    const data = { allergenId, lotNo: runId, expirationDate: new Date("2030-01-01"), receivedDate: new Date("2029-01-01"), initialQuantity: 10, currentQuantity: 10 };
    await prisma.reagentLot.create({ data });
    await expect(prisma.reagentLot.create({ data })).rejects.toMatchObject({ code: "P2002" });
  });

  it("persists, concurrently updates, searches, and deactivates a reusable order template", async () => {
    const templateName = `공용 주문 세트 ${crypto.randomUUID()}`;
    const created = await createOrderTemplate(prisma, {
      name: templateName,
      description: "통합 테스트 기본 구성",
      items: [{ allergenId, quantity: 2 }],
      actorId: userId
    });

    expect(created).toMatchObject({
      name: templateName,
      description: "통합 테스트 기본 구성",
      isActive: true,
      version: 1
    });
    expect(created.items).toHaveLength(1);
    expect(created.items[0]).toMatchObject({ allergenId, quantity: 2, position: 0 });

    const searched = await listActiveOrderTemplates(prisma, runId.toUpperCase());
    expect(searched.some((template) => template.id === created.id)).toBe(true);

    const updateResults = await Promise.allSettled([
      updateOrderTemplate(prisma, {
        id: created.id,
        expectedVersion: created.version,
        name: templateName,
        description: "동시 수정 A",
        items: [{ allergenId, quantity: 4 }],
        actorId: userId
      }),
      updateOrderTemplate(concurrentPrisma, {
        id: created.id,
        expectedVersion: created.version,
        name: templateName,
        description: "동시 수정 B",
        items: [{ allergenId, quantity: 5 }],
        actorId: userId
      })
    ]);
    const successfulUpdate = updateResults.find((result) => result.status === "fulfilled");
    const rejectedUpdate = updateResults.find((result) => result.status === "rejected");

    expect(updateResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(updateResults.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(rejectedUpdate).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({
        message: expect.stringMatching(/^(TEMPLATE_VERSION_CONFLICT|TRANSACTION_CONFLICT)$/)
      })
    });
    if (!successfulUpdate || successfulUpdate.status !== "fulfilled") {
      throw new Error("EXPECTED_ONE_SUCCESSFUL_TEMPLATE_UPDATE");
    }

    const updated = successfulUpdate.value;
    expect(updated.version).toBe(2);
    expect(["동시 수정 A", "동시 수정 B"]).toContain(updated.description);
    expect(updated.items[0]).toMatchObject({ allergenId, position: 0 });
    expect([4, 5]).toContain(updated.items[0].quantity);
    expect(await prisma.orderTemplate.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true }
    })).toMatchObject({
      version: updated.version,
      description: updated.description,
      items: [{ allergenId, quantity: updated.items[0].quantity, position: 0 }]
    });

    await expect(updateOrderTemplate(prisma, {
      id: created.id,
      expectedVersion: created.version,
      name: templateName,
      description: "오래된 편집 내용",
      items: [{ allergenId, quantity: 9 }],
      actorId: userId
    })).rejects.toThrow("TEMPLATE_VERSION_CONFLICT");

    const deactivated = await setOrderTemplateActive(prisma, {
      id: created.id,
      expectedVersion: updated.version,
      isActive: false,
      actorId: userId
    });
    expect(deactivated).toMatchObject({ isActive: false, version: 3 });
    expect((await listActiveOrderTemplates(prisma)).some((template) => template.id === created.id)).toBe(false);

    await prisma.allergen.update({ where: { id: allergenId }, data: { isActive: false } });
    try {
      await expect(setOrderTemplateActive(prisma, {
        id: created.id,
        expectedVersion: deactivated.version,
        isActive: true,
        actorId: userId
      })).rejects.toThrow("TEMPLATE_INACTIVE_ALLERGEN");

      const orderCountBefore = await prisma.order.count({ where: { clientId } });
      const orderAuditCountBefore = await prisma.auditLog.count({
        where: { actorId: userId, action: "ORDER_CREATE" }
      });
      await expect(createOrderValue(prisma, {
        clientId,
        memo: "비활성 시약이 담긴 오래된 주문 화면",
        items: [{ allergenId, quantity: 1 }],
        actorId: userId,
        now: new Date("2099-12-30T03:00:00.000Z")
      })).rejects.toThrow("ALLERGEN_NOT_FOUND");
      expect(await prisma.order.count({ where: { clientId } })).toBe(orderCountBefore);
      expect(await prisma.auditLog.count({
        where: { actorId: userId, action: "ORDER_CREATE" }
      })).toBe(orderAuditCountBefore);
    } finally {
      await prisma.allergen.update({ where: { id: allergenId }, data: { isActive: true } });
    }

    expect(await prisma.orderTemplate.findUniqueOrThrow({ where: { id: created.id } }))
      .toMatchObject({ isActive: false, version: 3 });
    expect(await prisma.auditLog.count({
      where: {
        actorId: userId,
        entityId: created.id,
        action: {
          in: ["ORDER_TEMPLATE_CREATE", "ORDER_TEMPLATE_UPDATE", "ORDER_TEMPLATE_DEACTIVATE"]
        }
      }
    })).toBe(3);
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
    const lot = await prisma.reagentLot.findFirstOrThrow({
      where: {
        allergenId,
        currentQuantity: {
          gt: 0
        }
      }
    });
    const beforeQuantity = lot.currentQuantity;
    await expect(prisma.$transaction(async (tx) => {
      await tx.reagentLot.update({ where: { id: lot.id }, data: { currentQuantity: { decrement: 1 } } });
      await tx.auditLog.create({ data: { action: "TEST_ROLLBACK", entityType: "LOT", entityId: lot.id, description: "rollback", actorId: userId } });
      throw new Error("ROLLBACK");
    })).rejects.toThrow("ROLLBACK");
    expect((await prisma.reagentLot.findUniqueOrThrow({ where: { id: lot.id } })).currentQuantity).toBe(beforeQuantity);
    expect(await prisma.auditLog.count({ where: { action: "TEST_ROLLBACK", actorId: userId } })).toBe(0);
  });
});
