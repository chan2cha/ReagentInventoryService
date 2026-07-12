import type { Prisma } from "@prisma/client";
import { buildLotWhere } from "@/domain/export-filters";
import {
  lotStatusFromSnapshot,
  lotStatusKindFromSnapshot,
  lotStatusLabel,
  lotStatusRequiresCrossModelComparison,
  type LotStatusKind,
  type LotStatusLabel
} from "@/domain/lot-status";
import { handleDataSourceError } from "@/lib/data-source";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, pageMeta, paginateRows, type PaginatedResult } from "@/lib/pagination";
import { findAllergen, formatDate, lots } from "../reagent-data";

const STATUS_SCAN_BATCH_SIZE = 500;

export type LotRow = {
  id: string;
  allergenName: string;
  allergenCode: string;
  lotNo: string;
  receivedDate: string;
  expirationDate: string;
  currentQuantity: number;
  initialQuantity: number;
  minStock: number | null;
  status: LotStatusLabel;
  source: "database" | "sample";
};

const lotRowSelect = {
  id: true,
  lotNo: true,
  receivedDate: true,
  expirationDate: true,
  currentQuantity: true,
  initialQuantity: true,
  allergen: {
    select: {
      name: true,
      code: true,
      minStock: true
    }
  }
} satisfies Prisma.ReagentLotSelect;

const lotRowOrder = [
  { expirationDate: "asc" as const },
  { lotNo: "asc" as const },
  { id: "asc" as const }
];

type DatabaseLotRow = Prisma.ReagentLotGetPayload<{ select: typeof lotRowSelect }>;

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function statusSnapshot(lot: DatabaseLotRow) {
  return {
    currentQuantity: lot.currentQuantity,
    expirationDate: lot.expirationDate,
    minStock: lot.allergen.minStock
  };
}

function toLotRow(lot: DatabaseLotRow, now: Date): LotRow {
  return {
    id: lot.id,
    allergenName: lot.allergen.name,
    allergenCode: lot.allergen.code,
    lotNo: lot.lotNo,
    receivedDate: toDateInput(lot.receivedDate),
    expirationDate: toDateInput(lot.expirationDate),
    currentQuantity: lot.currentQuantity,
    initialQuantity: lot.initialQuantity,
    minStock: lot.allergen.minStock,
    status: lotStatusFromSnapshot(statusSnapshot(lot), now),
    source: "database"
  };
}

function sampleLotRows(q = "", status?: LotStatusKind, now = new Date()): LotRow[] {
  const query = q.trim().toLocaleLowerCase("ko-KR");
  const statusLabel = status ? lotStatusLabel(status) : undefined;

  return lots
    .map((lot) => {
      const allergen = findAllergen(lot.allergenId);

      return {
        id: String(lot.id),
        allergenName: allergen?.name ?? "-",
        allergenCode: allergen?.code ?? "-",
        lotNo: lot.lotNo,
        receivedDate: lot.receivedDate,
        expirationDate: lot.expirationDate,
        currentQuantity: lot.quantity,
        initialQuantity: lot.quantity,
        minStock: allergen?.minStock ?? null,
        status: lotStatusFromSnapshot({
          currentQuantity: lot.quantity,
          expirationDate: lot.expirationDate,
          minStock: allergen?.minStock
        }, now),
        source: "sample" as const
      };
    })
    .filter((lot) => {
      if (statusLabel && lot.status !== statusLabel) return false;
      if (!query) return true;

      return [lot.allergenName, lot.allergenCode, lot.lotNo]
        .some((value) => value.toLocaleLowerCase("ko-KR").includes(query));
    })
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
}

async function getStatusFilteredRows(
  requestedPage: number,
  where: Prisma.ReagentLotWhereInput,
  status: LotStatusKind,
  now: Date
): Promise<PaginatedResult<LotRow>> {
  const normalizedRequestedPage = Math.max(1, requestedPage);
  const requestedSkip = (normalizedRequestedPage - 1) * PAGE_SIZE;
  const requestedRows: LotRow[] = [];
  const lastRows: LotRow[] = [];
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const candidates = await prisma.reagentLot.findMany({
      where,
      select: lotRowSelect,
      orderBy: lotRowOrder,
      take: STATUS_SCAN_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });

    for (const lot of candidates) {
      if (lotStatusKindFromSnapshot(statusSnapshot(lot), now) !== status) continue;

      const row = toLotRow(lot, now);
      if (total >= requestedSkip && requestedRows.length < PAGE_SIZE) {
        requestedRows.push(row);
      }

      lastRows.push(row);
      if (lastRows.length > PAGE_SIZE) lastRows.shift();
      total += 1;
    }

    if (candidates.length < STATUS_SCAN_BATCH_SIZE) break;
    cursor = candidates[candidates.length - 1].id;
  }

  const meta = pageMeta(normalizedRequestedPage, total);
  if (meta.page === normalizedRequestedPage) {
    return { ...meta, rows: requestedRows };
  }

  const lastPageSize = total - meta.skip;
  return { ...meta, rows: lastRows.slice(Math.max(0, lastRows.length - lastPageSize)) };
}

export async function getLotRows(
  page: number,
  q = "",
  status?: LotStatusKind,
  now = new Date()
): Promise<PaginatedResult<LotRow>> {
  try {
    const where = buildLotWhere({ q, status }, now);

    if (status && lotStatusRequiresCrossModelComparison(status)) {
      return await getStatusFilteredRows(page, where, status, now);
    }

    const total = await prisma.reagentLot.count({ where });
    const meta = pageMeta(page, total);
    const dbLots = await prisma.reagentLot.findMany({
      where,
      select: lotRowSelect,
      orderBy: lotRowOrder,
      skip: meta.skip,
      take: PAGE_SIZE
    });

    return { ...meta, rows: dbLots.map((lot) => toLotRow(lot, now)) };
  } catch (error) {
    return handleDataSourceError(
      "lots",
      error,
      () => paginateRows(sampleLotRows(q, status, now), page)
    );
  }
}

export function lotSourceLabel(rows: LotRow[]) {
  const source = rows[0]?.source ?? "database";

  if (source === "database") {
    return "최신 정보";
  }

  return "예시 정보";
}

export { formatDate };
