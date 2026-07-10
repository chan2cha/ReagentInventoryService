import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { daysUntilDateOnly, koreaDateKey } from "@/lib/date";
import { findAllergen, findClient, formatDate, lots, orderItemSummary, orders } from "../reagent-data";
import { lotStatus, type LotStatus, type OrderStatus } from "../reagent-data";
import { PAGE_SIZE,pageMeta,paginateRows,type PageMeta } from "@/lib/pagination";

export type ShipmentOrderRow = {
  id: string;
  orderNo: string;
  clientName: string;
  clientManager: string;
  orderDate: string;
  items: string;
  status: OrderStatus;
  source: "database" | "sample";
};

export type RecommendedLotRow = {
  id: string;
  allergenCode: string;
  allergenName: string;
  lotNo: string;
  expirationDate: string;
  currentQuantity: number;
  status: LotStatus;
  source: "database" | "sample";
};

export type ShipmentHistoryRow = {
  id: string;
  orderNo: string;
  clientName: string;
  shippedAt: string;
  itemSummary: string;
  status: "출고완료" | "취소";
  canCancel: boolean;
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

function statusFromDbLot(lot: {
  currentQuantity: number;
  expirationDate: Date;
}): LotStatus {
  const days = daysUntilDateOnly(lot.expirationDate);

  if (days < 0) return "유통기한 만료";
  if (lot.currentQuantity === 0) return "품절";
  if (days <= 30) return "유통기한 임박";
  return "정상";
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
        status: order.status,
        source: "sample"
      };
    });
}

function sampleRecommendedLots(): RecommendedLotRow[] {
  return lots
    .filter((lot) => lot.quantity > 0)
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate))
    .slice(0, 5)
    .map((lot) => {
      const allergen = findAllergen(lot.allergenId);

      return {
        id: String(lot.id),
        allergenCode: allergen?.code ?? "-",
        allergenName: allergen?.name ?? "-",
        lotNo: lot.lotNo,
        expirationDate: lot.expirationDate,
        currentQuantity: lot.quantity,
        status: lotStatus(lot),
        source: "sample"
      };
    });
}

export async function getShipmentPageData(orderPage:number,historyPage:number,orderQ = "",historyQ = ""): Promise<{
  orders: ShipmentOrderRow[];
  recommendedLots: RecommendedLotRow[];
  shipmentHistory: ShipmentHistoryRow[];
  orderMeta:PageMeta; historyMeta:PageMeta;
}> {
  try {
    const orderWhere = {
      status: { in: ["RECEIVED", "READY_TO_SHIP"] as Array<"RECEIVED" | "READY_TO_SHIP"> },
      ...(orderQ ? { OR: [
        { orderNo: { contains: orderQ, mode: "insensitive" as const } },
        { client: { is: { name: { contains: orderQ, mode: "insensitive" as const } } } },
        { client: { is: { managerName: { contains: orderQ, mode: "insensitive" as const } } } },
        { items: { some: { allergen: { is: { name: { contains: orderQ, mode: "insensitive" as const } } } } } },
        { items: { some: { allergen: { is: { code: { contains: orderQ, mode: "insensitive" as const } } } } } }
      ] } : {})
    };
    const historyWhere = historyQ ? { OR: [
      { order: { is: { orderNo: { contains: historyQ, mode: "insensitive" as const } } } },
      { order: { is: { client: { is: { name: { contains: historyQ, mode: "insensitive" as const } } } } } },
      { items: { some: { reagentLot: { is: { allergen: { is: { name: { contains: historyQ, mode: "insensitive" as const } } } } } } } },
      { items: { some: { reagentLot: { is: { allergen: { is: { code: { contains: historyQ, mode: "insensitive" as const } } } } } } } }
    ] } : {};
    const [orderTotal,historyTotal]=await Promise.all([prisma.order.count({where:orderWhere}),prisma.shipment.count({where:historyWhere})]);
    const orderMeta=pageMeta(orderPage,orderTotal); const historyMeta=pageMeta(historyPage,historyTotal);
    const [dbOrders, dbLots, dbShipments] = await Promise.all([
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
      prisma.reagentLot.findMany({
        where: {
          currentQuantity: {
            gt: 0
          },
          isActive: true
        },
        include: {
          allergen: true
        },
        orderBy: [
          { expirationDate: "asc" },
          { lotNo: "asc" }
        ],
        take: 5
      }),
      prisma.shipment.findMany({
        where: historyWhere,
        include: {
          order: {
            include: {
              client: true
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
          }
        },
        orderBy: {
          shippedAt: "desc"
        },
        skip:historyMeta.skip,take:PAGE_SIZE
      })
    ]);

    return {
      orderMeta,historyMeta,
      orders: dbOrders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        clientName: order.client.name,
        clientManager: order.client.managerName ?? "-",
        orderDate: koreaDateKey(order.createdAt),
        items: order.items.map((item) => `${item.allergen.code} ${item.quantity}`).join(", "),
        status: mapOrderStatus(order.status),
        source: "database"
      })),
      recommendedLots: dbLots.map((lot) => ({
        id: lot.id,
        allergenCode: lot.allergen.code,
        allergenName: lot.allergen.name,
        lotNo: lot.lotNo,
        expirationDate: lot.expirationDate.toISOString().slice(0, 10),
        currentQuantity: lot.currentQuantity,
        status: statusFromDbLot(lot),
        source: "database"
      })),
      shipmentHistory: dbShipments.map((shipment) => ({
        id: shipment.id,
        orderNo: shipment.order.orderNo,
        clientName: shipment.order.client.name,
        shippedAt: koreaDateKey(shipment.shippedAt),
        itemSummary: shipment.items
          .map((item) => `${item.reagentLot.allergen.code} ${item.quantity}`)
          .join(", "),
        status: shipment.status === "SHIPPED" ? "출고완료" : "취소",
        canCancel: shipment.status === "SHIPPED",
        source: "database"
      }))
    };
  } catch (error) {
    return handleDataSourceError("shipments", error, () => { const orderData=paginateRows(sampleShipmentOrders(),orderPage); const historyData=paginateRows<ShipmentHistoryRow>([],historyPage); return ({
      orders: orderData.rows, orderMeta:orderData,
      recommendedLots: sampleRecommendedLots(),
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
