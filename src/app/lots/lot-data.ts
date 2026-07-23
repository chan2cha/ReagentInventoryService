import type { Prisma } from "@prisma/client";

/** 창고별 LOT 재고를 화면 행으로 변환하고 상태별 페이지 조회를 담당한다. */
import { buildWarehouseStockWhere } from "@/domain/export-filters";
import {
  lotStatusFromSnapshot,
  lotStatusLabel,
  type LotStatusKind,
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

const warehouseStockRowOrder = [
  { reagentLot: { expirationDate: "asc" as const } },
  { reagentLot: { lotNo: "asc" as const } },
  { warehouse: "asc" as const },
  { reagentLotId: "asc" as const }
];

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
        status: lotStatusFromSnapshot({
          currentQuantity: lot.quantity,
          expirationDate: lot.expirationDate
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

export async function getLotRows(
  page: number,
  q = "",
  status?: LotStatusKind,
  warehouse?: WarehouseKind,
  now = new Date()
): Promise<PaginatedResult<LotRow>> {
  try {
    const where = buildWarehouseStockWhere({ q, status, warehouse }, now);

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
