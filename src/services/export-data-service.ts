import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  buildLotWhere,
  buildMovementWhere,
  normalizedLotStatus,
  type LotQueryFilters,
  type MovementQueryFilters
} from "../domain/export-filters";
import {
  lotStatusFromSnapshot,
  lotStatusKindFromSnapshot,
  lotStatusRequiresCrossModelComparison,
  type LotStatusKind,
  type LotStatusLabel
} from "../domain/lot-status";
import {
  stockMovementDelta,
  stockMovementTypeLabel,
  type StockMovementKind,
  type StockMovementLabel
} from "../domain/stock-movement-presentation";

export const EXPORT_ROW_LIMIT = 10_000;
export const EXPORT_QUERY_TAKE = EXPORT_ROW_LIMIT + 1;
const EXPORT_STATUS_SCAN_BATCH_SIZE = 1_000;

export type ExportDatabaseClient = PrismaClient | Prisma.TransactionClient;

export type ExportDataset = "lots" | "movements";
export type LotExportStatus = LotStatusLabel;

export type LotExportRow = {
  allergenCode: string;
  allergenName: string;
  category: string | null;
  lotNo: string;
  receivedDate: Date;
  expirationDate: Date;
  initialQuantity: number;
  currentQuantity: number;
  minStock: number;
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
  reason: string | null;
  refType: string | null;
  orderNo: string | null;
  clientName: string | null;
  actorName: string;
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
  id: true,
  lotNo: true,
  receivedDate: true,
  expirationDate: true,
  initialQuantity: true,
  currentQuantity: true,
  memo: true,
  isActive: true,
  allergen: {
    select: {
      code: true,
      name: true,
      category: true,
      minStock: true
    }
  }
} satisfies Prisma.ReagentLotSelect;

const movementExportSelect = {
  id: true,
  createdAt: true,
  type: true,
  quantity: true,
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

type LotExportRecord = Prisma.ReagentLotGetPayload<{ select: typeof lotExportSelect }>;
type MovementExportRecord = Prisma.StockMovementGetPayload<{ select: typeof movementExportSelect }>;

const lotExportOrder = [
  { expirationDate: "asc" as const },
  { lotNo: "asc" as const },
  { id: "asc" as const }
];

function lotStatusSnapshot(lot: LotExportRecord) {
  return {
    currentQuantity: lot.currentQuantity,
    expirationDate: lot.expirationDate,
    minStock: lot.allergen.minStock
  };
}

function assertWithinExportLimit(dataset: ExportDataset, rowCount: number) {
  if (rowCount > EXPORT_ROW_LIMIT) {
    throw new ExportRowLimitExceededError(dataset);
  }
}

async function listStatusFilteredLotRecords(
  db: ExportDatabaseClient,
  where: Prisma.ReagentLotWhereInput,
  status: LotStatusKind,
  now: Date
) {
  const matching: LotExportRecord[] = [];
  let cursor: string | undefined;

  while (true) {
    const candidates = await db.reagentLot.findMany({
      where,
      select: lotExportSelect,
      orderBy: lotExportOrder,
      take: EXPORT_STATUS_SCAN_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    for (const lot of candidates) {
      if (lotStatusKindFromSnapshot(lotStatusSnapshot(lot), now) !== status) continue;

      matching.push(lot);
      assertWithinExportLimit("lots", matching.length);
    }

    if (candidates.length < EXPORT_STATUS_SCAN_BATCH_SIZE) break;
    cursor = candidates[candidates.length - 1].id;
  }

  return matching;
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
  const status = normalizedLotStatus(filters.status);
  const where = buildLotWhere(filters, now);
  const lots = status && lotStatusRequiresCrossModelComparison(status)
    ? await listStatusFilteredLotRecords(db, where, status, now)
    : await db.reagentLot.findMany({
        where,
        select: lotExportSelect,
        orderBy: lotExportOrder,
        take: EXPORT_QUERY_TAKE
      });

  if (!status || !lotStatusRequiresCrossModelComparison(status)) {
    assertWithinExportLimit("lots", lots.length);
  }

  return lots.map((lot) => ({
    allergenCode: lot.allergen.code,
    allergenName: lot.allergen.name,
    category: lot.allergen.category,
    lotNo: lot.lotNo,
    receivedDate: lot.receivedDate,
    expirationDate: lot.expirationDate,
    initialQuantity: lot.initialQuantity,
    currentQuantity: lot.currentQuantity,
    minStock: lot.allergen.minStock,
    status: lotStatusFromSnapshot(lotStatusSnapshot(lot), now),
    isActive: lot.isActive,
    memo: lot.memo
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
      reason: movement.reason,
      refType: movement.refType,
      orderNo: shipment?.order.orderNo ?? null,
      clientName: shipment?.order.client.name ?? null,
      actorName: movement.creator.name
    };
  });
}
