import type { Prisma } from "@prisma/client";
/** 목록과 내보내기가 동일한 필터 기준을 쓰도록 Prisma 조건을 한곳에서 만든다. */
import {
  isStockMovementKind,
  type StockMovementKind
} from "./stock-movement-presentation";
import {
  isLotStatusKind,
  type LotStatusKind
} from "./lot-status";
import type { WarehouseKind } from "./warehouse";
import { addDateOnlyDays, dateOnlyUtc, koreaDateKey } from "../lib/date";

const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type LotQueryFilters = {
  q?: string;
  status?: string;
  warehouse?: string;
};

export type MovementQueryFilters = {
  q?: string;
  from?: string;
  to?: string;
  type?: string;
  warehouse?: string;
};

export type OrderQueryFilters = {
  q?: string;
  from?: string;
  to?: string;
};

function normalizedQuery(q?: string) {
  return q?.trim() ?? "";
}

function parseKoreaDateStart(value: string, field: "from" | "to") {
  const normalized = value.trim();
  const match = DATE_KEY_PATTERN.exec(normalized);

  if (!match) {
    throw new Error(`EXPORT_FILTER_${field.toUpperCase()}_INVALID`);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const dateOnlyUtc = new Date(Date.UTC(year, month - 1, day));

  if (
    year < 1000 ||
    dateOnlyUtc.getUTCFullYear() !== year ||
    dateOnlyUtc.getUTCMonth() !== month - 1 ||
    dateOnlyUtc.getUTCDate() !== day
  ) {
    throw new Error(`EXPORT_FILTER_${field.toUpperCase()}_INVALID`);
  }

  return new Date(dateOnlyUtc.getTime() - KOREA_OFFSET_MS);
}

function normalizedMovementType(value?: string): StockMovementKind | undefined {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return undefined;
  }

  if (!isStockMovementKind(normalized)) {
    throw new Error("EXPORT_FILTER_TYPE_INVALID");
  }

  return normalized;
}

export function normalizedLotStatus(value?: string): LotStatusKind | undefined {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return undefined;
  }

  if (!isLotStatusKind(normalized)) {
    throw new Error("EXPORT_FILTER_STATUS_INVALID");
  }

  return normalized;
}

function koreaCreatedAtRange(filters: { from?: string; to?: string }) {
  const from = filters.from?.trim() ? parseKoreaDateStart(filters.from, "from") : undefined;
  const to = filters.to?.trim() ? parseKoreaDateStart(filters.to, "to") : undefined;

  if (from && to && from.getTime() > to.getTime()) {
    throw new Error("EXPORT_FILTER_DATE_RANGE_INVALID");
  }

  if (!from && !to) return undefined;

  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lt: new Date(to.getTime() + DAY_MS) } : {})
  };
}

export function normalizedWarehouse(value?: string): WarehouseKind | undefined {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return undefined;
  }

  if (!/^[A-Z][A-Z0-9_]{1,29}$/.test(normalized)) {
    throw new Error("EXPORT_FILTER_WAREHOUSE_INVALID");
  }

  return normalized;
}

function lotStatusCandidateWhere(
  status: LotStatusKind,
  now: Date
): Prisma.WarehouseStockWhereInput {
  const today = dateOnlyUtc(koreaDateKey(now));
  const afterExpiring = addDateOnlyDays(koreaDateKey(now), 31);

  if (status === "EXPIRED") {
    return { reagentLot: { is: { expirationDate: { lt: today } } } };
  }

  if (status === "OUT_OF_STOCK") {
    return {
      quantity: 0,
      reagentLot: { is: { expirationDate: { gte: today } } }
    };
  }

  if (status === "EXPIRING") {
    return {
      quantity: { not: 0 },
      reagentLot: { is: { expirationDate: { gte: today, lt: afterExpiring } } }
    };
  }

  return {
    quantity: { not: 0 },
    reagentLot: { is: { expirationDate: { gte: afterExpiring } } }
  };
}

export function buildWarehouseStockWhere(
  filters: LotQueryFilters = {},
  now = new Date()
): Prisma.WarehouseStockWhereInput {
  const q = normalizedQuery(filters.q);
  const status = normalizedLotStatus(filters.status);
  const warehouse = normalizedWarehouse(filters.warehouse);
  const conditions: Prisma.WarehouseStockWhereInput[] = [];

  if (q) {
    conditions.push({
      reagentLot: { is: { OR: [
        { lotNo: { contains: q, mode: "insensitive" } },
        { allergen: { is: { name: { contains: q, mode: "insensitive" } } } },
        { allergen: { is: { code: { contains: q, mode: "insensitive" } } } }
      ] } }
    });
  }

  if (status) {
    conditions.push(lotStatusCandidateWhere(status, now));
  }

  if (warehouse) {
    conditions.push({ warehouse });
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}

/** @deprecated Prefer the model-specific name for new call sites. */
export const buildLotWhere = buildWarehouseStockWhere;

export function buildMovementWhere(
  filters: MovementQueryFilters = {}
): Prisma.StockMovementWhereInput {
  const q = normalizedQuery(filters.q);
  const type = normalizedMovementType(filters.type);
  const warehouse = normalizedWarehouse(filters.warehouse);
  const createdAt = koreaCreatedAtRange(filters);

  return {
    ...(q
      ? {
          OR: [
            { reason: { contains: q, mode: "insensitive" as const } },
            { reagentLot: { is: { lotNo: { contains: q, mode: "insensitive" as const } } } },
            {
              reagentLot: {
                is: {
                  allergen: {
                    is: { name: { contains: q, mode: "insensitive" as const } }
                  }
                }
              }
            },
            {
              reagentLot: {
                is: {
                  allergen: {
                    is: { code: { contains: q, mode: "insensitive" as const } }
                  }
                }
              }
            }
          ]
        }
      : {}),
    ...(type ? { type } : {}),
    ...(warehouse
      ? {
          AND: [{
            OR: [
              { warehouse },
              { destinationWarehouse: warehouse }
            ]
          }]
        }
      : {}),
    ...(createdAt ? { createdAt } : {})
  };
}

export function buildOrderWhere(
  filters: OrderQueryFilters = {}
): Prisma.OrderWhereInput {
  const q = normalizedQuery(filters.q);
  const createdAt = koreaCreatedAtRange(filters);

  return {
    ...(q
      ? {
          OR: [
            { orderNo: { contains: q, mode: "insensitive" as const } },
            { memo: { contains: q, mode: "insensitive" as const } },
            { client: { is: { name: { contains: q, mode: "insensitive" as const } } } },
            { client: { is: { managerName: { contains: q, mode: "insensitive" as const } } } },
            { items: { some: { allergen: { is: { name: { contains: q, mode: "insensitive" as const } } } } } },
            { items: { some: { allergen: { is: { code: { contains: q, mode: "insensitive" as const } } } } } }
          ]
        }
      : {}),
    ...(createdAt ? { createdAt } : {})
  };
}
