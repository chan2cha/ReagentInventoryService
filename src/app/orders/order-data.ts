import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { koreaDateKey } from "@/lib/date";
import {
  findAllergen,
  findClient,
  formatDate,
  orderItemSummary,
  orders,
  type OrderOriginLabel,
  type OrderStatus
} from "../reagent-data";
import { PAGE_SIZE, pageMeta, paginateRows, type PaginatedResult } from "@/lib/pagination";
import type { ItemQuantity } from "../item-quantity-summary";
import { buildOrderWhere } from "@/domain/export-filters";

export type OrderRow = {
  id: string;
  orderNo: string;
  clientId: string;
  clientName: string;
  clientManager: string;
  orderDate: string;
  items: string;
  itemDetails: ItemQuantity[];
  editableItems: Array<{ allergenId: string; quantity: number }>;
  memo: string;
  image: {
    fileName: string;
    byteSize: number;
  } | null;
  origin: OrderOriginLabel;
  status: OrderStatus;
  canEdit: boolean;
  canEditFully: boolean;
  canCancel: boolean;
  source: "database" | "sample";
};

function sampleOrderRows(): OrderRow[] {
  return orders.map((order) => {
    const client = findClient(order.clientId);

    return {
      id: String(order.id),
      orderNo: order.orderNo,
      clientId: String(order.clientId),
      clientName: client?.name ?? "-",
      clientManager: client?.manager ?? "-",
      orderDate: order.orderDate,
      items: orderItemSummary(order),
      itemDetails: order.items.map((item) => ({ code: findAllergen(item.allergenId)?.code ?? "-", quantity: item.quantity })),
      editableItems: order.items.map((item) => ({ allergenId: String(item.allergenId), quantity: item.quantity })),
      memo: order.memo || "-",
      image: null,
      origin: "신규주문",
      status: order.status,
      canEdit: order.status !== "취소",
      canEditFully: order.status === "접수" || order.status === "준비중",
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

function mapOrderOrigin(origin: "MANUAL" | "SHORTAGE_REORDER"): OrderOriginLabel {
  return origin === "SHORTAGE_REORDER" ? "출고예정" : "신규주문";
}

export async function getOrderRows(
  page: number,
  q = "",
  from = "",
  to = ""
): Promise<PaginatedResult<OrderRow>> {
  try {
    const where = {
      ...buildOrderWhere({ q, from, to }),
      origin: "MANUAL"
    } satisfies Prisma.OrderWhereInput;
    const requestedSkip = (Math.max(1, page) - 1) * PAGE_SIZE;
    const orderQuery = {
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
        },
        image: {
          select: {
            fileName: true,
            byteSize: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }, skip: requestedSkip, take: PAGE_SIZE
    } satisfies Prisma.OrderFindManyArgs;
    const [total, initialOrders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany(orderQuery)
    ]);
    const meta = pageMeta(page, total);
    const dbOrders = meta.skip === requestedSkip
      ? initialOrders
      : await prisma.order.findMany({ ...orderQuery, skip: meta.skip });

    return { ...meta, rows: dbOrders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      clientId: order.clientId,
      clientName: order.client.name,
      clientManager: order.client.managerName ?? "-",
      orderDate: koreaDateKey(order.createdAt),
      items: order.items
        .map((item) => `${item.allergen.code} ${item.quantity}`)
        .join(", "),
      itemDetails: order.items.map((item) => ({ code: item.allergen.code, quantity: item.quantity })),
      editableItems: order.items.map((item) => ({ allergenId: item.allergenId, quantity: item.quantity })),
      memo: order.memo || "-",
      image: order.image,
      origin: mapOrderOrigin(order.origin),
      status: mapOrderStatus(order.status),
      canEdit: order.status !== "CANCELLED",
      canEditFully: order.status === "RECEIVED" || order.status === "READY_TO_SHIP",
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
