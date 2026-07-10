import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { koreaDateKey } from "@/lib/date";
import {
  findClient,
  formatDate,
  orderItemSummary,
  orders,
  type OrderStatus
} from "../reagent-data";
import { PAGE_SIZE, pageMeta, paginateRows, type PaginatedResult } from "@/lib/pagination";

export type OrderRow = {
  id: string;
  orderNo: string;
  clientName: string;
  clientManager: string;
  orderDate: string;
  items: string;
  memo: string;
  status: OrderStatus;
  canCancel: boolean;
  source: "database" | "sample";
};

function sampleOrderRows(): OrderRow[] {
  return orders.map((order) => {
    const client = findClient(order.clientId);

    return {
      id: String(order.id),
      orderNo: order.orderNo,
      clientName: client?.name ?? "-",
      clientManager: client?.manager ?? "-",
      orderDate: order.orderDate,
      items: orderItemSummary(order),
      memo: order.memo || "-",
      status: order.status,
      canCancel: order.status === "접수" || order.status === "준비중",
      source: "sample"
    };
  });
}

function mapOrderStatus(status: "RECEIVED" | "READY_TO_SHIP" | "SHIPPED" | "CANCELLED"): OrderStatus {
  const map = {
    RECEIVED: "접수",
    READY_TO_SHIP: "준비중",
    SHIPPED: "출고완료",
    CANCELLED: "취소"
  } satisfies Record<typeof status, OrderStatus>;

  return map[status];
}

export async function getOrderRows(page: number, q = ""): Promise<PaginatedResult<OrderRow>> {
  try {
    const where = q ? { OR: [
      { orderNo: { contains: q, mode: "insensitive" as const } },
      { memo: { contains: q, mode: "insensitive" as const } },
      { client: { is: { name: { contains: q, mode: "insensitive" as const } } } },
      { client: { is: { managerName: { contains: q, mode: "insensitive" as const } } } },
      { items: { some: { allergen: { is: { name: { contains: q, mode: "insensitive" as const } } } } } },
      { items: { some: { allergen: { is: { code: { contains: q, mode: "insensitive" as const } } } } } }
    ] } : {};
    const total = await prisma.order.count({ where }); const meta = pageMeta(page, total); const dbOrders = await prisma.order.findMany({
      where,
      include: {
        client: true,
        items: {
          include: {
            allergen: true
          },
          orderBy: {
            id: "asc"
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }, skip: meta.skip, take: PAGE_SIZE
    });

    return { ...meta, rows: dbOrders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      clientName: order.client.name,
      clientManager: order.client.managerName ?? "-",
      orderDate: koreaDateKey(order.createdAt),
      items: order.items
        .map((item) => `${item.allergen.code} ${item.quantity}`)
        .join(", "),
      memo: order.memo || "-",
      status: mapOrderStatus(order.status),
      canCancel: order.status === "RECEIVED" || order.status === "READY_TO_SHIP",
      source: "database"
    })) };
  } catch (error) {
    return handleDataSourceError("orders", error, () => paginateRows(sampleOrderRows(), page));
  }
}

export function orderSourceLabel(rows: OrderRow[]) {
  const source = rows[0]?.source ?? "database";

  if (source === "database") {
    return "최신 정보";
  }

  return "예시 정보";
}

export { formatDate };
