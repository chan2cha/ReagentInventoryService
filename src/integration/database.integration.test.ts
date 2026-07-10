import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testUrl = process.env.TEST_DATABASE_URL;
const productionUrl = process.env.DATABASE_URL;

function target(url: string) {
  const parsed = new URL(url);
  return `${parsed.username}@${parsed.hostname}/${parsed.pathname}?schema=${parsed.searchParams.get("schema") ?? "public"}`;
}

if (!testUrl) throw new Error("TEST_DATABASE_URL_REQUIRED");
if (productionUrl && target(testUrl) === target(productionUrl)) throw new Error("TEST_DATABASE_MUST_BE_ISOLATED");

const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
const runId = `integration-${Date.now()}`;
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

async function shipOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (order.status === "SHIPPED") throw new Error("ORDER_ALREADY_SHIPPED");
    const shipment = await tx.shipment.create({ data: { orderId, shippedBy: userId } });

    for (const item of order.items) {
      let remaining = item.quantity;
      const lots = await tx.reagentLot.findMany({ where: { allergenId: item.allergenId, currentQuantity: { gt: 0 }, isActive: true }, orderBy: [{ expirationDate: "asc" }, { lotNo: "asc" }] });
      for (const lot of lots) {
        if (remaining === 0) break;
        const quantity = Math.min(remaining, lot.currentQuantity);
        remaining -= quantity;
        await tx.reagentLot.update({ where: { id: lot.id }, data: { currentQuantity: { decrement: quantity } } });
        await tx.shipmentItem.create({ data: { shipmentId: shipment.id, reagentLotId: lot.id, allergenId: item.allergenId, quantity } });
        await tx.stockMovement.create({ data: { reagentLotId: lot.id, type: "OUT", quantity, createdBy: userId } });
      }
      if (remaining > 0) throw new Error("INSUFFICIENT_STOCK");
    }

    await tx.order.update({ where: { id: orderId }, data: { status: "SHIPPED" } });
    await tx.auditLog.create({ data: { action: "SHIPMENT_CREATE", entityType: "SHIPMENT", entityId: shipment.id, description: "integration shipment", actorId: userId } });
    return shipment;
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
    await prisma.auditLog.deleteMany({ where: { actorId: userId } });
    await prisma.stockMovement.deleteMany({ where: { creator: { id: userId } } });
    await prisma.shipmentItem.deleteMany({ where: { shipment: { order: { clientId } } } });
    await prisma.shipment.deleteMany({ where: { order: { clientId } } });
    await prisma.orderItem.deleteMany({ where: { order: { clientId } } });
    await prisma.order.deleteMany({ where: { clientId } });
    await prisma.reagentLot.deleteMany({ where: { allergenId } });
    await prisma.allergen.deleteMany({ where: { id: allergenId } });
    await prisma.client.deleteMany({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("allocates earliest-expiring lots and blocks duplicate shipment", async () => {
    const early = await prisma.reagentLot.create({ data: { allergenId, lotNo: `${runId}-early`, expirationDate: new Date("2031-01-01"), receivedDate: new Date("2029-01-01"), initialQuantity: 2, currentQuantity: 2 } });
    const later = await prisma.reagentLot.create({ data: { allergenId, lotNo: `${runId}-later`, expirationDate: new Date("2032-01-01"), receivedDate: new Date("2029-01-01"), initialQuantity: 5, currentQuantity: 5 } });
    const order = await createOrder(5);
    const shipment = await shipOrder(order.id);
    expect(await prisma.shipmentItem.findMany({ where: { shipmentId: shipment.id }, orderBy: { reagentLot: { expirationDate: "asc" } }, select: { reagentLotId: true, quantity: true } })).toEqual([{ reagentLotId: early.id, quantity: 2 }, { reagentLotId: later.id, quantity: 3 }]);
    await expect(shipOrder(order.id)).rejects.toThrow("ORDER_ALREADY_SHIPPED");
  });

  it("rolls back an insufficient shipment without stock or audit changes", async () => {
    const order = await createOrder(10000);
    const before = await prisma.reagentLot.aggregate({ where: { allergenId }, _sum: { currentQuantity: true } });
    await expect(shipOrder(order.id)).rejects.toThrow("INSUFFICIENT_STOCK");
    const after = await prisma.reagentLot.aggregate({ where: { allergenId }, _sum: { currentQuantity: true } });
    expect(after._sum.currentQuantity).toBe(before._sum.currentQuantity);
    expect(await prisma.shipment.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "SHIPMENT_CREATE", entityId: order.id } })).toBe(0);
  });

  it("restores lot quantities and order status when shipment is cancelled", async () => {
    const shipment = await prisma.shipment.findFirstOrThrow({ where: { order: { clientId }, status: "SHIPPED" }, include: { items: true } });
    await prisma.$transaction(async (tx) => {
      for (const item of shipment.items) await tx.reagentLot.update({ where: { id: item.reagentLotId }, data: { currentQuantity: { increment: item.quantity } } });
      await tx.shipment.update({ where: { id: shipment.id }, data: { status: "CANCELLED" } });
      await tx.order.update({ where: { id: shipment.orderId }, data: { status: "READY_TO_SHIP" } });
      await tx.auditLog.create({ data: { action: "SHIPMENT_CANCEL", entityType: "SHIPMENT", entityId: shipment.id, description: "integration cancel", actorId: userId } });
    });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: shipment.orderId } })).status).toBe("READY_TO_SHIP");
    expect((await prisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } })).status).toBe("CANCELLED");
    expect(await prisma.auditLog.count({ where: { action: "SHIPMENT_CANCEL", entityId: shipment.id } })).toBe(1);
  });

  it("rejects duplicate reagent lots", async () => {
    const data = { allergenId, lotNo: runId, expirationDate: new Date("2030-01-01"), receivedDate: new Date("2029-01-01"), initialQuantity: 10, currentQuantity: 10 };
    await prisma.reagentLot.create({ data });
    await expect(prisma.reagentLot.create({ data })).rejects.toMatchObject({ code: "P2002" });
  });

  it("rolls back stock and audit writes when a transaction fails", async () => {
    const lot = await prisma.reagentLot.findFirstOrThrow({ where: { allergenId } });
    await expect(prisma.$transaction(async (tx) => {
      await tx.reagentLot.update({ where: { id: lot.id }, data: { currentQuantity: { decrement: 3 } } });
      await tx.auditLog.create({ data: { action: "TEST_ROLLBACK", entityType: "LOT", entityId: lot.id, description: "rollback", actorId: userId } });
      throw new Error("ROLLBACK");
    })).rejects.toThrow("ROLLBACK");
    expect((await prisma.reagentLot.findUniqueOrThrow({ where: { id: lot.id } })).currentQuantity).toBe(10);
    expect(await prisma.auditLog.count({ where: { action: "TEST_ROLLBACK", actorId: userId } })).toBe(0);
  });
});
