import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { addDateOnlyDays, dateOnlyUtc, koreaDateKey } from "@/lib/date";
import { findAllergen, findClient, formatDate, orderItemSummary, orders } from "../reagent-data";
import { type OrderOriginLabel, type OrderStatus, type ShipmentFulfillmentLabel } from "../reagent-data";
import { PAGE_SIZE,pageMeta,paginateRows,type PageMeta } from "@/lib/pagination";
import { pendingShipmentOrderWhere } from "@/domain/pending-shipment";
import type { ItemQuantity } from "../item-quantity-summary";

export type ShipmentOrderRow = {
  id: string;
  orderNo: string;
  clientName: string;
  clientManager: string;
  orderDate: string;
  items: string;
  itemDetails: ItemQuantity[];
  origin: OrderOriginLabel;
  status: OrderStatus;
  source: "database" | "sample";
  allocationItems?: ShipmentAllocationItemRow[];
};

export type ShipmentOrderOrigin = "MANUAL" | "SHORTAGE_REORDER";

export type ShipmentAllocationItemRow = {
  id: string;
  code: string;
  name: string;
  quantity: number;
  availableQuantity: number;
  lots: Array<{
    id: string;
    lotId: string;
    lotNo: string;
    warehouse: string;
    warehouseName: string;
    expirationDate: string;
    currentQuantity: number;
    recommendedQuantity: number;
  }>;
};

export type ShipmentHistoryRow = {
  id: string;
  orderId: string;
  orderNo: string;
  clientName: string;
  shippedAt: string;
  itemSummary: string;
  itemDetails: ItemQuantity[];
  memo: string;
  editableMemo: string;
  orderImage: { fileName: string; byteSize: number } | null;
  status: ShipmentFulfillmentLabel;
  canEdit: boolean;
  canCancel: boolean;
  cancellationBlockedReason?: string;
  source: "database" | "sample";
};

function mapOrderStatus(status: "RECEIVED" | "READY_TO_SHIP" | "SHIPPED" | "CANCELLED"): OrderStatus {
  const map = {
    RECEIVED: "접수",
    READY_TO_SHIP: "준비중",
    SHIPPED: "출고완료",
    CANCELLED: "취소"
  } satisfies Record<typeof status, OrderStatus>;

  return map[status];
}

function mapOrderOrigin(origin: "MANUAL" | "SHORTAGE_REORDER"): OrderOriginLabel {
  return origin === "SHORTAGE_REORDER" ? "출고예정" : "신규주문";
}

function mapShipmentFulfillmentStatus(
  status: "SHIPPED" | "CANCELLED",
  fulfillmentStatus: "NORMAL" | "PARTIAL"
): ShipmentFulfillmentLabel {
  if (status === "CANCELLED") return "취소";
  return fulfillmentStatus === "PARTIAL" ? "부분 출고" : "정상 출고";
}

function sampleShipmentOrders(): ShipmentOrderRow[] {
  return orders
    .filter((order) => order.status === "접수" || order.status === "준비중")
    .map((order) => {
      const client = findClient(order.clientId);

      return {
        id: String(order.id),
        orderNo: order.orderNo,
        clientName: client?.name ?? "-",
        clientManager: client?.manager ?? "-",
        orderDate: order.orderDate,
        items: orderItemSummary(order),
        itemDetails: order.items.map((item) => ({ code: findAllergen(item.allergenId)?.code ?? "-", quantity: item.quantity })),
        origin: "신규주문",
        status: order.status,
        source: "sample"
      };
    });
}

export async function getShipmentPageData(
  orderPage: number,
  historyPage: number,
  orderQ = "",
  historyQ = "",
  orderOrigin: ShipmentOrderOrigin = "SHORTAGE_REORDER"
): Promise<{
  orders: ShipmentOrderRow[];
  shipmentHistory: ShipmentHistoryRow[];
  orderMeta:PageMeta; historyMeta:PageMeta;
}> {
  try {
    const todayKey = koreaDateKey();
    const today = dateOnlyUtc(todayKey);
    const tomorrow = addDateOnlyDays(todayKey, 1);
    const orderWhere = {
      ...pendingShipmentOrderWhere(),
      origin: orderOrigin,
      ...(orderQ ? { OR: [
        { orderNo: { contains: orderQ, mode: "insensitive" as const } },
        { client: { is: { name: { contains: orderQ, mode: "insensitive" as const } } } },
        { client: { is: { managerName: { contains: orderQ, mode: "insensitive" as const } } } },
        { items: { some: { allergen: { is: { name: { contains: orderQ, mode: "insensitive" as const } } } } } },
        { items: { some: { allergen: { is: { code: { contains: orderQ, mode: "insensitive" as const } } } } } }
      ] } : {})
    };
    const historyWhere = { purpose: "ORDER" as const, ...(historyQ ? { OR: [
      { order: { is: { orderNo: { contains: historyQ, mode: "insensitive" as const } } } },
      { order: { is: { client: { is: { name: { contains: historyQ, mode: "insensitive" as const } } } } } },
      { items: { some: { reagentLot: { is: { allergen: { is: { name: { contains: historyQ, mode: "insensitive" as const } } } } } } } },
      { items: { some: { reagentLot: { is: { allergen: { is: { code: { contains: historyQ, mode: "insensitive" as const } } } } } } } }
    ] } : {}) };
    const [orderTotal,historyTotal]=await Promise.all([prisma.order.count({where:orderWhere}),prisma.shipment.count({where:historyWhere})]);
    const orderMeta=pageMeta(orderPage,orderTotal); const historyMeta=pageMeta(historyPage,historyTotal);
    const warehouses = await prisma.warehouse.findMany({
      select: { code: true, name: true, isActive: true },
      orderBy: { name: "asc" }
    });
    const activeWarehouseCodes = warehouses
      .filter((warehouse) => warehouse.isActive)
      .map((warehouse) => warehouse.code);
    const warehouseNames = new Map(
      warehouses.map((warehouse) => [warehouse.code, warehouse.name])
    );
    const [dbOrders, dbShipments] = await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        include: {
          client: true,
          items: {
            include: {
              allergen: true
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        },skip:orderMeta.skip,take:PAGE_SIZE
      }),
      prisma.shipment.findMany({
        where: historyWhere,
        include: {
          order: {
            include: {
              client: true,
              image: {
                select: { fileName: true, byteSize: true }
              }
            }
          },
          items: {
            include: {
              reagentLot: {
                include: {
                  allergen: true
                }
              }
            }
          },
          shortageReorder: {
            select: {
              status: true
            }
          }
        },
        orderBy: {
          shippedAt: "desc"
        },
        skip:historyMeta.skip,take:PAGE_SIZE
      })
    ]);
    const allocationAllergenIds = [...new Set(dbOrders.flatMap((order) => order.items.map((item) => item.allergenId)))];
    const allocationStocks = allocationAllergenIds.length === 0 || activeWarehouseCodes.length === 0 ? [] : await prisma.warehouseStock.findMany({
      where: {
        warehouse: { in: activeWarehouseCodes },
        quantity: { gt: 0 },
        reagentLot: { is: {
          allergenId: { in: allocationAllergenIds },
          expirationDate: { gte: today },
          receivedDate: { lt: tomorrow },
          isActive: true
        } }
      },
      include: { reagentLot: true },
      orderBy: [
        { reagentLot: { expirationDate: "asc" } },
        { reagentLot: { lotNo: "asc" } },
        { warehouse: "asc" }
      ]
    });

    return {
      orderMeta,historyMeta,
      orders: dbOrders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        clientName: order.client.name,
        clientManager: order.client.managerName ?? "-",
        orderDate: koreaDateKey(order.createdAt),
        items: order.items.map((item) => `${item.allergen.code} ${item.quantity}`).join(", "),
        itemDetails: order.items.map((item) => ({ code: item.allergen.code, quantity: item.quantity })),
        origin: mapOrderOrigin(order.origin),
        status: mapOrderStatus(order.status),
        source: "database",
        allocationItems: order.items.map((item) => {
          let remaining = item.quantity;
          const lotsForItem = allocationStocks.filter((stock) => stock.reagentLot.allergenId === item.allergenId).map((stock) => {
            const recommendedQuantity = Math.min(remaining, stock.quantity);
            remaining -= recommendedQuantity;
            return {
              id: `${stock.reagentLotId}:${stock.warehouse}`,
              lotId: stock.reagentLotId,
              lotNo: stock.reagentLot.lotNo,
              warehouse: stock.warehouse,
              warehouseName: warehouseNames.get(stock.warehouse) ?? stock.warehouse,
              expirationDate: stock.reagentLot.expirationDate.toISOString().slice(0, 10),
              currentQuantity: stock.quantity,
              recommendedQuantity
            };
          });
          return { id: item.id, code: item.allergen.code, name: item.allergen.name, quantity: item.quantity, availableQuantity: lotsForItem.reduce((sum, lot) => sum + lot.currentQuantity, 0), lots: lotsForItem };
        })
      })),
      shipmentHistory: dbShipments.map((shipment) => ({
        id: shipment.id,
        orderId: shipment.orderId,
        orderNo: shipment.order.orderNo,
        clientName: shipment.order.client.name,
        shippedAt: koreaDateKey(shipment.shippedAt),
        itemSummary: shipment.items
          .map((item) => `${item.reagentLot.allergen.code} · ${item.reagentLot.lotNo} · ${warehouseNames.get(item.warehouse) ?? item.warehouse} ${item.quantity}`)
          .join(", "),
        itemDetails: shipment.items.map((item) => ({
          code: `${item.reagentLot.allergen.code} · ${item.reagentLot.lotNo} · ${warehouseNames.get(item.warehouse) ?? item.warehouse}`,
          quantity: item.quantity
        })),
        memo: shipment.memo ?? "-",
        editableMemo: shipment.memo ?? "",
        orderImage: shipment.order.image,
        status: mapShipmentFulfillmentStatus(shipment.status, shipment.fulfillmentStatus),
        canEdit: shipment.status === "SHIPPED",
        canCancel: shipment.status === "SHIPPED" && shipment.shortageReorder?.status !== "SHIPPED",
        cancellationBlockedReason: shipment.status === "SHIPPED" && shipment.shortageReorder?.status === "SHIPPED"
          ? "부족분 출고 취소 후 가능"
          : undefined,
        source: "database"
      }))
    };
  } catch (error) {
    return handleDataSourceError("shipments", error, () => { const orderData=paginateRows(sampleShipmentOrders().filter(() => orderOrigin === "MANUAL"),orderPage); const historyData=paginateRows<ShipmentHistoryRow>([],historyPage); return ({
      orders: orderData.rows, orderMeta:orderData,
      shipmentHistory: historyData.rows, historyMeta:historyData
    });});
  }
}

export function shipmentSourceLabel(rows: Array<{ source: "database" | "sample" }>) {
  const source = rows[0]?.source ?? "database";

  if (source === "database") {
    return "최신 정보";
  }

  return "예시 정보";
}

export { formatDate };
