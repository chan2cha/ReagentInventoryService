import type { Prisma } from "@prisma/client";
import {
  isStockMovementKind,
  type StockMovementKind
} from "./stock-movement-presentation";
import {
  isLotStatusKind,
  type LotStatusKind
} from "./lot-status";
import { addDateOnlyDays, dateOnlyUtc, koreaDateKey } from "../lib/date";

const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type LotQueryFilters = {
  q?: string;
  status?: string;
};

export type MovementQueryFilters = {
  q?: string;
  from?: string;
  to?: string;
  type?: string;
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

function lotStatusCandidateWhere(
  status: LotStatusKind,
  now: Date
): Prisma.ReagentLotWhereInput {
  const today = dateOnlyUtc(koreaDateKey(now));
  const afterExpiring = addDateOnlyDays(koreaDateKey(now), 31);

  if (status === "EXPIRED") {
    return { expirationDate: { lt: today } };
  }

  if (status === "OUT_OF_STOCK") {
    return {
      expirationDate: { gte: today },
      currentQuantity: 0
    };
  }

  if (status === "EXPIRING") {
    return {
      expirationDate: { gte: today, lt: afterExpiring },
      currentQuantity: { not: 0 }
    };
  }

  return {
    expirationDate: { gte: afterExpiring },
    currentQuantity: { not: 0 },
    ...(status === "LOW_STOCK"
      ? { allergen: { is: { minStock: { gt: 0 } } } }
      : {})
  };
}

export function buildLotWhere(
  filters: LotQueryFilters = {},
  now = new Date()
): Prisma.ReagentLotWhereInput {
  const q = normalizedQuery(filters.q);
  const status = normalizedLotStatus(filters.status);
  const conditions: Prisma.ReagentLotWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { lotNo: { contains: q, mode: "insensitive" } },
        { allergen: { is: { name: { contains: q, mode: "insensitive" } } } },
        { allergen: { is: { code: { contains: q, mode: "insensitive" } } } }
      ]
    });
  }

  if (status) {
    conditions.push(lotStatusCandidateWhere(status, now));
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}

export function buildMovementWhere(
  filters: MovementQueryFilters = {}
): Prisma.StockMovementWhereInput {
  const q = normalizedQuery(filters.q);
  const type = normalizedMovementType(filters.type);
  const from = filters.from?.trim() ? parseKoreaDateStart(filters.from, "from") : undefined;
  const to = filters.to?.trim() ? parseKoreaDateStart(filters.to, "to") : undefined;

  if (from && to && from.getTime() > to.getTime()) {
    throw new Error("EXPORT_FILTER_DATE_RANGE_INVALID");
  }

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
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lt: new Date(to.getTime() + DAY_MS) } : {})
          }
        }
      : {})
  };
}
