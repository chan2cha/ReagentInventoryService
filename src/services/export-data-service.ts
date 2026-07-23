import "server-only";

import type { OrderStatus, Prisma, PrismaClient } from "@prisma/client";
import {
  buildMovementWhere,
  buildOrderWhere,
  buildWarehouseStockWhere,
  normalizedLotStatus,
  normalizedWarehouse,
  type LotQueryFilters,
  type MovementQueryFilters,
  type OrderQueryFilters
} from "../domain/export-filters";
import {
  lotStatusFromSnapshot,
  type LotStatusLabel
} from "../domain/lot-status";
import {
  stockMovementDelta,
  stockMovementTypeLabel,
  type StockMovementKind,
  type StockMovementLabel
} from "../domain/stock-movement-presentation";
import type { WarehouseKind } from "../domain/warehouse";

export const EXPORT_ROW_LIMIT = 10_000;
export const EXPORT_QUERY_TAKE = EXPORT_ROW_LIMIT + 1;

export type ExportDatabaseClient = PrismaClient | Prisma.TransactionClient;

export type ExportDataset = "lots" | "movements" | "orders";
export type LotExportStatus = LotStatusLabel;

export type LotExportRow = {
  allergenCode: string;
  allergenName: string;
  category: string | null;
  lotNo: string;
  receivedDate: Date;
  expirationDate: Date;
  warehouse: WarehouseKind;
  currentQuantity: number;
  status: LotExportStatus;
  isActive: boolean;
  memo: string | null;
};

export type MovementExportRow = {
  createdAt: Date;
  type: StockMovementKind;
  typeLabel: StockMovementLabel;
  rawQuantity: number;
  deltaQuantity: number;
  allergenCode: string;
  allergenName: string;
  lotNo: string;
  expirationDate: Date;
  warehouse: WarehouseKind;
  destinationWarehouse: WarehouseKind | null;
  reason: string | null;
  refType: string | null;
  orderNo: string | null;
  clientName: string | null;
  actorName: string;
};

export type OrderExportRow = {
  orderId: string;
  createdAt: Date;
  orderNo: string;
  status: "접수" | "준비중" | "출고완료" | "취소";
  clientName: string;
  clientManager: string | null;
  allergenCode: string;
  allergenName: string;
  quantity: number;
  memo: string | null;
  hasImage: boolean;
  creatorName: string;
};

export type LotExportOptions = LotQueryFilters & {
  now?: Date;
};

export class ExportRowLimitExceededError extends Error {
  readonly code = "EXPORT_ROW_LIMIT_EXCEEDED";

  constructor(
    readonly dataset: ExportDataset,
    readonly limit = EXPORT_ROW_LIMIT
  ) {
    super(`EXPORT_ROW_LIMIT_EXCEEDED:${dataset}:${limit}`);
    this.name = "ExportRowLimitExceededError";
  }
}

const lotExportSelect = {
  warehouse: true,
  quantity: true,
  reagentLot: {
    select: {
      id: true,
      lotNo: true,
      receivedDate: true,
      expirationDate: true,
      memo: true,
      isActive: true,
      allergen: {
        select: {
          code: true,
          name: true,
          category: true
        }
      }
    }
  }
} satisfies Prisma.WarehouseStockSelect;

const movementExportSelect = {
  id: true,
  createdAt: true,
  type: true,
  quantity: true,
  warehouse: true,
  destinationWarehouse: true,
  reason: true,
  refType: true,
  refId: true,
  creator: {
    select: {
      name: true
    }
  },
  reagentLot: {
    select: {
      lotNo: true,
      expirationDate: true,
      allergen: {
        select: {
          code: true,
          name: true
        }
      }
    }
  }
} satisfies Prisma.StockMovementSelect;

const orderExportSelect = {
  id: true,
  quantity: true,
  allergen: {
    select: {
      code: true,
      name: true
    }
  },
  order: {
    select: {
      id: true,
      createdAt: true,
      orderNo: true,
      status: true,
      memo: true,
      client: {
        select: {
          name: true,
          managerName: true
        }
      },
      creator: {
        select: {
          name: true
        }
      },
      image: {
        select: {
          id: true
        }
      }
    }
  }
} satisfies Prisma.OrderItemSelect;

type LotExportRecord = Prisma.WarehouseStockGetPayload<{ select: typeof lotExportSelect }>;
type MovementExportRecord = Prisma.StockMovementGetPayload<{ select: typeof movementExportSelect }>;
type OrderExportRecord = Prisma.OrderItemGetPayload<{ select: typeof orderExportSelect }>;

const lotExportOrder = [
  { reagentLot: { expirationDate: "asc" as const } },
  { reagentLot: { lotNo: "asc" as const } },
  { warehouse: "asc" as const },
  { reagentLotId: "asc" as const }
];

function lotStatusSnapshot(lot: LotExportRecord) {
  return {
    currentQuantity: lot.quantity,
    expirationDate: lot.reagentLot.expirationDate
  };
}

function assertWithinExportLimit(dataset: ExportDataset, rowCount: number) {
  if (rowCount > EXPORT_ROW_LIMIT) {
    throw new ExportRowLimitExceededError(dataset);
  }
}

function shipmentReferenceIds(movements: MovementExportRecord[]) {
  return Array.from(new Set(movements.flatMap((movement) => {
    if (
      (movement.refType === "SHIPMENT" || movement.refType === "SHIPMENT_CANCEL") &&
      movement.refId
    ) {
      return [movement.refId];
    }

    return [];
  })));
}

export async function listLotExportRows(
  db: ExportDatabaseClient,
  options: LotExportOptions = {}
): Promise<LotExportRow[]> {
  const { now = new Date(), ...filters } = options;
  normalizedLotStatus(filters.status);
  normalizedWarehouse(filters.warehouse);
  const where = buildWarehouseStockWhere(filters, now);

  const lots = await db.warehouseStock.findMany({
        where,
        select: lotExportSelect,
        orderBy: lotExportOrder,
        take: EXPORT_QUERY_TAKE
      });

  assertWithinExportLimit("lots", lots.length);

  return lots.map((lot) => ({
    allergenCode: lot.reagentLot.allergen.code,
    allergenName: lot.reagentLot.allergen.name,
    category: lot.reagentLot.allergen.category,
    lotNo: lot.reagentLot.lotNo,
    receivedDate: lot.reagentLot.receivedDate,
    expirationDate: lot.reagentLot.expirationDate,
    warehouse: lot.warehouse,
    currentQuantity: lot.quantity,
    status: lotStatusFromSnapshot(lotStatusSnapshot(lot), now),
    isActive: lot.reagentLot.isActive,
    memo: lot.reagentLot.memo
  }));
}

export async function listMovementExportRows(
  db: ExportDatabaseClient,
  filters: MovementQueryFilters = {}
): Promise<MovementExportRow[]> {
  const movements = await db.stockMovement.findMany({
    where: buildMovementWhere(filters),
    select: movementExportSelect,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" }
    ],
    take: EXPORT_QUERY_TAKE
  });

  assertWithinExportLimit("movements", movements.length);

  const referenceIds = shipmentReferenceIds(movements);
  const shipments = referenceIds.length
    ? await db.shipment.findMany({
        where: {
          id: {
            in: referenceIds
          }
        },
        select: {
          id: true,
          order: {
            select: {
              orderNo: true,
              client: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      })
    : [];
  const shipmentById = new Map(shipments.map((shipment) => [shipment.id, shipment]));

  return movements.map((movement) => {
    const shipment = movement.refId ? shipmentById.get(movement.refId) : undefined;

    return {
      createdAt: movement.createdAt,
      type: movement.type,
      typeLabel: stockMovementTypeLabel(movement.type),
      rawQuantity: movement.quantity,
      deltaQuantity: stockMovementDelta(movement.type, movement.quantity),
      allergenCode: movement.reagentLot.allergen.code,
      allergenName: movement.reagentLot.allergen.name,
      lotNo: movement.reagentLot.lotNo,
      expirationDate: movement.reagentLot.expirationDate,
      warehouse: movement.warehouse,
      destinationWarehouse: movement.destinationWarehouse,
      reason: movement.reason,
      refType: movement.refType,
      orderNo: shipment?.order.orderNo ?? null,
      clientName: shipment?.order.client.name ?? null,
      actorName: movement.creator.name
    };
  });
}

function orderStatusLabel(status: OrderStatus): OrderExportRow["status"] {
  const labels = {
    RECEIVED: "접수",
    READY_TO_SHIP: "준비중",
    SHIPPED: "출고완료",
    CANCELLED: "취소"
  } satisfies Record<OrderStatus, OrderExportRow["status"]>;

  return labels[status];
}

export async function listOrderExportRows(
  db: ExportDatabaseClient,
  filters: OrderQueryFilters = {}
): Promise<OrderExportRow[]> {
  const items: OrderExportRecord[] = await db.orderItem.findMany({
    where: {
      order: {
        is: buildOrderWhere(filters)
      }
    },
    select: orderExportSelect,
    orderBy: [
      { order: { createdAt: "desc" } },
      { order: { id: "desc" } },
      { id: "asc" }
    ],
    take: EXPORT_QUERY_TAKE
  });

  assertWithinExportLimit("orders", items.length);

  return items.map((item) => ({
    orderId: item.order.id,
    createdAt: item.order.createdAt,
    orderNo: item.order.orderNo,
    status: orderStatusLabel(item.order.status),
    clientName: item.order.client.name,
    clientManager: item.order.client.managerName,
    allergenCode: item.allergen.code,
    allergenName: item.allergen.name,
    quantity: item.quantity,
    memo: item.order.memo,
    hasImage: Boolean(item.order.image),
    creatorName: item.order.creator.name
  }));
}
