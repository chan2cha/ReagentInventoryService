import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { addDateOnlyDays, dateOnlyUtc, daysUntilDateOnly, koreaDateKey, koreaDayRange } from "@/lib/date";
import { pendingShipmentOrderWhere } from "@/domain/pending-shipment";
import {
  allergens,
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

export type DashboardCategoryRow = {
  category: string;
  count: number;
  source: "database" | "sample";
};

export type DashboardData = {
  stats: {
    todayOrders: number;
    pendingShipments: number;
    todayShipments: number;
    expiringLots: number;
    lowLots: number;
  };
  priorityLots: DashboardLotRow[];
  orderSummary: DashboardOrderRow[];
  recentMovements: DashboardMovementRow[];
  categories: DashboardCategoryRow[];
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

function mapMovementType(type: "IN" | "OUT" | "ADJUST" | "DISPOSE" | "REVERSE"): MovementType {
  const map = {
    IN: "입고",
    OUT: "출고",
    ADJUST: "조정",
    DISPOSE: "폐기",
    REVERSE: "조정"
  } satisfies Record<typeof type, MovementType>;

  return map[type];
}

function statusFromDbLot(lot: {
  currentQuantity: number;
  expirationDate: Date;
  allergen: {
    minStock: number;
  };
}): LotStatus {
  const days = daysUntilDateOnly(lot.expirationDate);

  if (days < 0) return "유통기한 만료";
  if (lot.currentQuantity === 0) return "품절";
  if (days <= 30) return "유통기한 임박";
  if (lot.allergen.minStock > 0 && lot.currentQuantity < lot.allergen.minStock) return "재고부족";
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

  const categories = ["흡입성", "식품성"].map((category) => ({
    category,
    count: allergens.filter((allergen) => allergen.category === category).length,
    source: "sample" as const
  }));

  return {
    stats: dashboard,
    priorityLots,
    orderSummary,
    recentMovements,
    categories
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const today = koreaDayRange();
    const todayKey = koreaDateKey();
    const expiringFrom = dateOnlyUtc(todayKey);
    const expiringTo = addDateOnlyDays(todayKey, 31);

    const [
      todayOrders,
      pendingShipments,
      todayShipments,
      expiringLots,
      stockPolicyLots,
      priorityLots,
      orderSummary,
      recentMovements,
      categoryGroups
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
      prisma.reagentLot.count({
        where: {
          expirationDate: {
            gte: expiringFrom,
            lt: expiringTo
          },
          isActive: true
        }
      }),
      prisma.reagentLot.findMany({
        where: {
          allergen: {
            minStock: {
              gt: 0
            }
          },
          isActive: true
        },
        select: {
          currentQuantity: true,
          allergen: {
            select: {
              minStock: true
            }
          }
        }
      }),
      prisma.reagentLot.findMany({
        include: {
          allergen: true
        },
        orderBy: [
          { expirationDate: "asc" },
          { lotNo: "asc" }
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
      prisma.allergen.groupBy({
        by: ["category"],
        _count: {
          _all: true
        },
        orderBy: {
          category: "asc"
        }
      })
    ]);

    return {
      stats: {
        todayOrders,
        pendingShipments,
        todayShipments,
        expiringLots,
        lowLots: stockPolicyLots.filter((lot) => lot.currentQuantity < lot.allergen.minStock).length
      },
      priorityLots: priorityLots.map((lot) => ({
        id: lot.id,
        allergenName: lot.allergen.name,
        lotNo: lot.lotNo,
        expirationDate: lot.expirationDate.toISOString().slice(0, 10),
        quantity: lot.currentQuantity,
        status: statusFromDbLot(lot),
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
      categories: categoryGroups.map((group) => ({
        category: group.category ?? "-",
        count: group._count._all,
        source: "database"
      }))
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
