import { prisma } from "@/lib/prisma";

/** 대시보드의 서로 독립적인 요약 지표를 읽고, 개발 환경에서만 샘플 데이터로 대체한다. */
import { handleDataSourceError } from "@/lib/data-source";
import { addDateOnlyDays, dateOnlyUtc, daysUntilDateOnly, koreaDateKey, koreaDayRange } from "@/lib/date";
import { pendingShipmentOrderWhere } from "@/domain/pending-shipment";
import { getReplacementPolicy } from "@/services/replacement-service";
import {
  dashboard,
  findAllergen,
  findClient,
  formatDate,
  lots,
  lotStatus,
  movements,
  orders,
  type LotStatus,
  type MovementType,
  type OrderStatus
} from "./reagent-data";

export type DashboardLotRow = {
  id: string;
  allergenName: string;
  lotNo: string;
  expirationDate: string;
  quantity: number;
  status: LotStatus;
  source: "database" | "sample";
};

export type DashboardOrderRow = {
  id: string;
  orderNo: string;
  clientName: string;
  status: OrderStatus;
  source: "database" | "sample";
};

export type DashboardMovementRow = {
  id: string;
  date: string;
  type: MovementType;
  allergenName: string;
  lotNo: string;
  quantity: number;
  memo: string;
  source: "database" | "sample";
};

export type DashboardData = {
  stats: {
    todayOrders: number;
    pendingShipments: number;
    todayShipments: number;
    expiringLots: number;
  };
  priorityLots: DashboardLotRow[];
  orderSummary: DashboardOrderRow[];
  recentMovements: DashboardMovementRow[];
  replacementSummary: {
    candidateCount: number;
    confirmedCount: number;
    completedCount: number;
    source: "database" | "sample";
  };
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

function mapMovementType(type: "IN" | "OUT" | "ADJUST" | "DISPOSE" | "REVERSE" | "TRANSFER"): MovementType {
  const map = {
    IN: "입고",
    OUT: "출고",
    ADJUST: "조정",
    DISPOSE: "폐기",
    REVERSE: "조정",
    TRANSFER: "창고이동"
  } satisfies Record<typeof type, MovementType>;

  return map[type];
}

function statusFromDbLot(lot: {
  quantity: number;
  expirationDate: Date;
}): LotStatus {
  const days = daysUntilDateOnly(lot.expirationDate);

  if (days < 0) return "유통기한 만료";
  if (lot.quantity === 0) return "품절";
  if (days <= 30) return "유통기한 임박";
  return "정상";
}

function sampleDashboardData(): DashboardData {
  const priorityLots = [...lots]
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate))
    .slice(0, 6)
    .map((lot) => ({
      id: String(lot.id),
      allergenName: findAllergen(lot.allergenId)?.name ?? "-",
      lotNo: lot.lotNo,
      expirationDate: lot.expirationDate,
      quantity: lot.quantity,
      status: lotStatus(lot),
      source: "sample" as const
    }));

  const orderSummary = orders.slice(0, 4).map((order) => ({
    id: String(order.id),
    orderNo: order.orderNo,
    clientName: findClient(order.clientId)?.name ?? "-",
    status: order.status,
    source: "sample" as const
  }));

  const recentMovements = movements.slice(0, 5).map((movement) => ({
    id: String(movement.id),
    date: movement.date,
    type: movement.type,
    allergenName: findAllergen(movement.allergenId)?.name ?? "-",
    lotNo: movement.lotNo,
    quantity: movement.quantity,
    memo: movement.memo,
    source: "sample" as const
  }));

  return {
    stats: dashboard,
    priorityLots,
    orderSummary,
    recentMovements,
    replacementSummary: { candidateCount: 0, confirmedCount: 0, completedCount: 0, source: "sample" }
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const today = koreaDayRange();
    const todayKey = koreaDateKey();
    const expiringFrom = dateOnlyUtc(todayKey);
    const expiringTo = addDateOnlyDays(todayKey, 31);
    const replacementPolicy = await getReplacementPolicy(prisma);
    const replacementThreshold = addDateOnlyDays(todayKey, replacementPolicy.detectionDays);

    const [
      todayOrders,
      pendingShipments,
      todayShipments,
      expiringLots,
      priorityStocks,
      orderSummary,
      recentMovements,
      replacementCandidateCount,
      confirmedReplacementCount,
      completedReplacementCount
    ] = await Promise.all([
      prisma.order.count({
        where: {
          createdAt: today
        }
      }),
      prisma.order.count({
        where: pendingShipmentOrderWhere()
      }),
      prisma.shipment.count({
        where: {
          shippedAt: today
        }
      }),
      prisma.warehouseStock.count({
        where: {
          warehouse: "FINISHED_GOODS",
          quantity: { gt: 0 },
          reagentLot: { is: {
            expirationDate: { gte: expiringFrom, lt: expiringTo },
            isActive: true
          } }
        }
      }),
      prisma.warehouseStock.findMany({
        where: { warehouse: "FINISHED_GOODS" },
        include: {
          reagentLot: { include: { allergen: true } }
        },
        orderBy: [
          { reagentLot: { expirationDate: "asc" } },
          { reagentLot: { lotNo: "asc" } }
        ],
        take: 6
      }),
      prisma.order.findMany({
        include: {
          client: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 4
      }),
      prisma.stockMovement.findMany({
        include: {
          reagentLot: {
            include: {
              allergen: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5
      }),
      prisma.shipmentItem.count({
        where: {
          shipment: { status: "SHIPPED", purpose: "ORDER" },
          reagentLot: { expirationDate: { lte: replacementThreshold } },
          replacement: { is: null }
        }
      }),
      prisma.replacement.count({ where: { status: "CONFIRMED" } }),
      prisma.replacement.count({ where: { status: "COMPLETED" } })
    ]);

    return {
      stats: {
        todayOrders,
        pendingShipments,
        todayShipments,
        expiringLots
      },
      priorityLots: priorityStocks.map((stock) => ({
        id: `${stock.reagentLotId}:${stock.warehouse}`,
        allergenName: stock.reagentLot.allergen.name,
        lotNo: stock.reagentLot.lotNo,
        expirationDate: stock.reagentLot.expirationDate.toISOString().slice(0, 10),
        quantity: stock.quantity,
        status: statusFromDbLot({
          quantity: stock.quantity,
          expirationDate: stock.reagentLot.expirationDate
        }),
        source: "database"
      })),
      orderSummary: orderSummary.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        clientName: order.client.name,
        status: mapOrderStatus(order.status),
        source: "database"
      })),
      recentMovements: recentMovements.map((movement) => ({
        id: movement.id,
        date: koreaDateKey(movement.createdAt),
        type: mapMovementType(movement.type),
        allergenName: movement.reagentLot.allergen.name,
        lotNo: movement.reagentLot.lotNo,
        quantity: movement.quantity,
        memo: movement.reason ?? "-",
        source: "database"
      })),
      replacementSummary: {
        candidateCount: replacementCandidateCount,
        confirmedCount: confirmedReplacementCount,
        completedCount: completedReplacementCount,
        source: "database"
      }
    };
  } catch (error) {
    return handleDataSourceError("dashboard", error, sampleDashboardData);
  }
}

export function dashboardSourceLabel(rows: Array<{ source: "database" | "sample" }>) {
  const source = rows[0]?.source ?? "database";

  if (source === "database") {
    return "최신 정보";
  }

  return "예시 정보";
}

export { formatDate };
