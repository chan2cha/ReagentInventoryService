import type { Prisma } from "@prisma/client";

/** 창고별 LOT 재고를 화면 행으로 변환하고 상태별 페이지 조회를 담당한다. */
import { buildWarehouseStockWhere } from "@/domain/export-filters";
import {
  lotStatusFromSnapshot,
  lotStatusLabel,
  lotStatusRequiresCrossModelComparison,
  type LotStatusKind,
  type LotStatusLabel
} from "@/domain/lot-status";
import type { WarehouseKind } from "@/domain/warehouse";
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
  lotId: string;
  warehouse: WarehouseKind;
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

const warehouseStockRowSelect = {
  reagentLotId: true,
  warehouse: true,
  quantity: true,
  reagentLot: {
    select: {
      lotNo: true,
      receivedDate: true,
      expirationDate: true,
      initialQuantity: true,
      allergen: {
        select: {
          name: true,
          code: true,
          minStock: true
        }
      }
    }
  }
} satisfies Prisma.WarehouseStockSelect;

const warehouseStockRowOrder = [
  { reagentLot: { expirationDate: "asc" as const } },
  { reagentLot: { lotNo: "asc" as const } },
  { warehouse: "asc" as const },
  { reagentLotId: "asc" as const }
];

type DatabaseWarehouseStockRow = Prisma.WarehouseStockGetPayload<{
  select: typeof warehouseStockRowSelect;
}>;

function statusFilteredRecordToStock(record: StatusFilteredLotRecord): DatabaseWarehouseStockRow {
  return {
    reagentLotId: record.id,
    warehouse: record.warehouse,
    quantity: record.currentQuantity,
    reagentLot: {
      lotNo: record.lotNo,
      receivedDate: record.receivedDate,
      expirationDate: record.expirationDate,
      initialQuantity: record.initialQuantity,
      allergen: {
        name: record.allergenName,
        code: record.allergenCode,
        minStock: record.minStock
      }
    }
  };
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function statusSnapshot(stock: DatabaseWarehouseStockRow) {
  return {
    currentQuantity: stock.quantity,
    expirationDate: stock.reagentLot.expirationDate,
    minStock: stock.reagentLot.allergen.minStock
  };
}

function toLotRow(stock: DatabaseWarehouseStockRow, now: Date): LotRow {
  const lot = stock.reagentLot;

  return {
    id: `${stock.reagentLotId}:${stock.warehouse}`,
    lotId: stock.reagentLotId,
    warehouse: stock.warehouse,
    allergenName: lot.allergen.name,
    allergenCode: lot.allergen.code,
    lotNo: lot.lotNo,
    receivedDate: toDateInput(lot.receivedDate),
    expirationDate: toDateInput(lot.expirationDate),
    currentQuantity: stock.quantity,
    initialQuantity: lot.initialQuantity,
    minStock: lot.allergen.minStock,
    status: lotStatusFromSnapshot(statusSnapshot(stock), now),
    source: "database"
  };
}

function sampleLotRows(
  q = "",
  status?: LotStatusKind,
  warehouse?: WarehouseKind,
  now = new Date()
): LotRow[] {
  const query = q.trim().toLocaleLowerCase("ko-KR");
  const statusLabel = status ? lotStatusLabel(status) : undefined;

  return lots
    .map((lot) => {
      const allergen = findAllergen(lot.allergenId);
      const sampleWarehouse = lot.warehouse;

      return {
        id: `${lot.id}:${sampleWarehouse}`,
        lotId: String(lot.id),
        warehouse: sampleWarehouse,
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
      if (warehouse && lot.warehouse !== warehouse) return false;
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
  warehouse: WarehouseKind | undefined,
  now: Date
): Promise<PaginatedResult<LotRow>> {
  // LOW_STOCK/NORMAL은 관계 테이블의 최소재고 비교가 필요하므로 전용 SQL을 사용한다.
  const normalizedRequestedPage = Math.max(1, requestedPage);
  const requestedSkip = (normalizedRequestedPage - 1) * PAGE_SIZE;
  const queryOptions = {
    q,
    status: status as Extract<LotStatusKind, "LOW_STOCK" | "NORMAL">,
    now,
    warehouse
  };
  const [total, initialRecords] = await Promise.all([
    countStatusFilteredLots(prisma, queryOptions),
    listStatusFilteredLots(prisma, { ...queryOptions, skip: requestedSkip, take: PAGE_SIZE })
  ]);

  const meta = pageMeta(normalizedRequestedPage, total);
  const records = meta.skip === requestedSkip
    ? initialRecords
    : await listStatusFilteredLots(prisma, { ...queryOptions, skip: meta.skip, take: PAGE_SIZE });

  return {
    ...meta,
    rows: records.map((record) => toLotRow(statusFilteredRecordToStock(record), now))
  };
}

export async function getLotRows(
  page: number,
  q = "",
  status?: LotStatusKind,
  warehouse?: WarehouseKind,
  now = new Date()
): Promise<PaginatedResult<LotRow>> {
  try {
    const where = buildWarehouseStockWhere({ q, status, warehouse }, now);

    if (status && lotStatusRequiresCrossModelComparison(status)) {
      return await getStatusFilteredRows(page, q, status, warehouse, now);
    }

    const requestedSkip = (Math.max(1, page) - 1) * PAGE_SIZE;
    const stockQuery = {
      where,
      select: warehouseStockRowSelect,
      orderBy: warehouseStockRowOrder,
      skip: requestedSkip,
      take: PAGE_SIZE
    } satisfies Prisma.WarehouseStockFindManyArgs;
    const [total, initialStocks] = await Promise.all([
      prisma.warehouseStock.count({ where }),
      prisma.warehouseStock.findMany(stockQuery)
    ]);
    const meta = pageMeta(page, total);
    const dbStocks = meta.skip === requestedSkip
      ? initialStocks
      : await prisma.warehouseStock.findMany({ ...stockQuery, skip: meta.skip });

    return { ...meta, rows: dbStocks.map((stock) => toLotRow(stock, now)) };
  } catch (error) {
    return handleDataSourceError(
      "lots",
      error,
      () => paginateRows(sampleLotRows(q, status, warehouse, now), page)
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
