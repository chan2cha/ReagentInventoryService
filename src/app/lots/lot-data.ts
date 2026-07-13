import type { Prisma } from "@prisma/client";

/** LOT 목록의 DB 행을 화면 행으로 변환하고 상태별 페이지 조회를 담당한다. */
import { buildLotWhere } from "@/domain/export-filters";
import {
  lotStatusFromSnapshot,
  lotStatusLabel,
  lotStatusRequiresCrossModelComparison,
  type LotStatusKind,
  type LotStatusLabel
} from "@/domain/lot-status";
import { handleDataSourceError } from "@/lib/data-source";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, pageMeta, paginateRows, type PaginatedResult } from "@/lib/pagination";
import {
  countStatusFilteredLots,
  listStatusFilteredLots,
  type StatusFilteredLotRecord
} from "@/services/status-filtered-lot-query";
import { findAllergen, formatDate, lots } from "../reagent-data";

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

function statusFilteredRecordToLot(record: StatusFilteredLotRecord): DatabaseLotRow {
  return {
    id: record.id,
    lotNo: record.lotNo,
    receivedDate: record.receivedDate,
    expirationDate: record.expirationDate,
    currentQuantity: record.currentQuantity,
    initialQuantity: record.initialQuantity,
    allergen: {
      name: record.allergenName,
      code: record.allergenCode,
      minStock: record.minStock
    }
  };
}

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
  q: string,
  status: LotStatusKind,
  now: Date
): Promise<PaginatedResult<LotRow>> {
  // LOW_STOCK/NORMAL은 관계 테이블의 최소재고 비교가 필요하므로 전용 SQL을 사용한다.
  const normalizedRequestedPage = Math.max(1, requestedPage);
  const requestedSkip = (normalizedRequestedPage - 1) * PAGE_SIZE;
  const queryOptions = { q, status: status as Extract<LotStatusKind, "LOW_STOCK" | "NORMAL">, now };
  const [total, initialRecords] = await Promise.all([
    countStatusFilteredLots(prisma, queryOptions),
    listStatusFilteredLots(prisma, { ...queryOptions, skip: requestedSkip, take: PAGE_SIZE })
  ]);

  const meta = pageMeta(normalizedRequestedPage, total);
  const records = meta.skip === requestedSkip
    ? initialRecords
    : await listStatusFilteredLots(prisma, { ...queryOptions, skip: meta.skip, take: PAGE_SIZE });

  return { ...meta, rows: records.map((record) => toLotRow(statusFilteredRecordToLot(record), now)) };
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
      return await getStatusFilteredRows(page, q, status, now);
    }

    const requestedSkip = (Math.max(1, page) - 1) * PAGE_SIZE;
    const lotQuery = {
      where,
      select: lotRowSelect,
      orderBy: lotRowOrder,
      skip: requestedSkip,
      take: PAGE_SIZE
    } satisfies Prisma.ReagentLotFindManyArgs;
    const [total, initialLots] = await Promise.all([
      prisma.reagentLot.count({ where }),
      prisma.reagentLot.findMany(lotQuery)
    ]);
    const meta = pageMeta(page, total);
    const dbLots = meta.skip === requestedSkip
      ? initialLots
      : await prisma.reagentLot.findMany({ ...lotQuery, skip: meta.skip });

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
