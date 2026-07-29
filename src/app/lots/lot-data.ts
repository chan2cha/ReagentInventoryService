import type { Prisma } from "@prisma/client";

/** 창고별 LOT 재고를 화면 행으로 변환하고 상태별 페이지 조회를 담당한다. */
import { buildWarehouseStockWhere } from "@/domain/export-filters";
import {
  lotStatusFromSnapshot,
  lotStatusLabel,
  type LotStatusFilter,
  type LotStatusLabel
} from "@/domain/lot-status";
import type { WarehouseKind } from "@/domain/warehouse";
import { handleDataSourceError } from "@/lib/data-source";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, pageMeta, paginateRows, type PaginatedResult } from "@/lib/pagination";
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
  status: LotStatusLabel;
  source: "database" | "sample";
};

export const LOT_SORT_KINDS = [
  "EXPIRATION_ASC",
  "RECEIVED_DESC",
  "RECEIVED_ASC",
  "QUANTITY_DESC",
  "QUANTITY_ASC",
  "LOT_NO_ASC"
] as const;

export type LotSortKind = (typeof LOT_SORT_KINDS)[number];

export const DEFAULT_LOT_SORT: LotSortKind = "EXPIRATION_ASC";

export function isLotSortKind(value: string): value is LotSortKind {
  return LOT_SORT_KINDS.includes(value as LotSortKind);
}

export function lotSortLabel(sort: LotSortKind) {
  return {
    EXPIRATION_ASC: "유통기한 빠른 순",
    RECEIVED_DESC: "최근 입고 순",
    RECEIVED_ASC: "오래된 입고 순",
    QUANTITY_DESC: "수량 많은 순",
    QUANTITY_ASC: "수량 적은 순",
    LOT_NO_ASC: "제조번호 순"
  }[sort];
}

const warehouseStockRowSelect = {
  reagentLotId: true,
  warehouse: true,
  quantity: true,
  reagentLot: {
    select: {
      lotNo: true,
      receivedDate: true,
      expirationDate: true,
      allergen: {
        select: {
          name: true,
          code: true
        }
      }
    }
  }
} satisfies Prisma.WarehouseStockSelect;

function warehouseStockRowOrder(sort: LotSortKind) {
  const tieBreakers = [
    { reagentLot: { expirationDate: "asc" as const } },
    { reagentLot: { lotNo: "asc" as const } },
    { warehouse: "asc" as const },
    { reagentLotId: "asc" as const }
  ];

  const primaryOrder: Record<
    LotSortKind,
    Prisma.WarehouseStockOrderByWithRelationInput[]
  > = {
    EXPIRATION_ASC: [],
    RECEIVED_DESC: [{ reagentLot: { receivedDate: "desc" } }],
    RECEIVED_ASC: [{ reagentLot: { receivedDate: "asc" } }],
    QUANTITY_DESC: [{ quantity: "desc" }],
    QUANTITY_ASC: [{ quantity: "asc" }],
    LOT_NO_ASC: [{ reagentLot: { lotNo: "asc" } }]
  };

  return [...primaryOrder[sort], ...tieBreakers]
    .filter((order, index, orders) => (
      index === orders.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(order))
    ));
}

type DatabaseWarehouseStockRow = Prisma.WarehouseStockGetPayload<{
  select: typeof warehouseStockRowSelect;
}>;

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function statusSnapshot(stock: DatabaseWarehouseStockRow) {
  return {
    currentQuantity: stock.quantity,
    expirationDate: stock.reagentLot.expirationDate
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
    status: lotStatusFromSnapshot(statusSnapshot(stock), now),
    source: "database"
  };
}

function sampleLotRows(
  q = "",
  status?: LotStatusFilter,
  warehouse?: WarehouseKind,
  sort: LotSortKind = DEFAULT_LOT_SORT,
  now = new Date()
): LotRow[] {
  const query = q.trim().toLocaleLowerCase("ko-KR");
  const statusLabel = status && status !== "ALL" ? lotStatusLabel(status) : undefined;

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
        status: lotStatusFromSnapshot({
          currentQuantity: lot.quantity,
          expirationDate: lot.expirationDate
        }, now),
        source: "sample" as const
      };
    })
    .filter((lot) => {
      if (warehouse && lot.warehouse !== warehouse) return false;
      if (!status && lot.currentQuantity === 0) return false;
      if (statusLabel && lot.status !== statusLabel) return false;
      if (!query) return true;

      return [lot.allergenName, lot.allergenCode, lot.lotNo]
        .some((value) => value.toLocaleLowerCase("ko-KR").includes(query));
    })
    .sort((a, b) => {
      const primary = {
        EXPIRATION_ASC: () => a.expirationDate.localeCompare(b.expirationDate),
        RECEIVED_DESC: () => b.receivedDate.localeCompare(a.receivedDate),
        RECEIVED_ASC: () => a.receivedDate.localeCompare(b.receivedDate),
        QUANTITY_DESC: () => b.currentQuantity - a.currentQuantity,
        QUANTITY_ASC: () => a.currentQuantity - b.currentQuantity,
        LOT_NO_ASC: () => a.lotNo.localeCompare(b.lotNo, "ko-KR")
      }[sort]();

      return primary
        || a.expirationDate.localeCompare(b.expirationDate)
        || a.lotNo.localeCompare(b.lotNo, "ko-KR")
        || a.warehouse.localeCompare(b.warehouse)
        || a.lotId.localeCompare(b.lotId);
    });
}

export async function getLotRows(
  page: number,
  q = "",
  status?: LotStatusFilter,
  warehouse?: WarehouseKind,
  sort: LotSortKind = DEFAULT_LOT_SORT,
  now = new Date()
): Promise<PaginatedResult<LotRow>> {
  try {
    const where = buildWarehouseStockWhere({ q, status, warehouse }, now);

    const requestedSkip = (Math.max(1, page) - 1) * PAGE_SIZE;
    const stockQuery = {
      where,
      select: warehouseStockRowSelect,
      orderBy: warehouseStockRowOrder(sort),
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
      () => paginateRows(sampleLotRows(q, status, warehouse, sort, now), page)
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
