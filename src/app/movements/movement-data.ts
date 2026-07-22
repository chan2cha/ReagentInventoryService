import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { koreaDateKey } from "@/lib/date";
import { buildMovementWhere } from "@/domain/export-filters";
import {
  stockMovementTypeLabel,
  type StockMovementKind,
  type StockMovementLabel
} from "@/domain/stock-movement-presentation";
import { warehouseLabel, type WarehouseKind, type WarehouseLabel, type WarehouseOption } from "@/domain/warehouse";
import { findAllergen, formatDate, movements } from "../reagent-data";
import { PAGE_SIZE, pageMeta, paginateRows, type PaginatedResult } from "@/lib/pagination";

export type MovementRow = {
  id: string;
  date: string;
  type: StockMovementLabel;
  allergenName: string;
  allergenCode: string;
  lotNo: string;
  quantity: number;
  warehouse: WarehouseLabel;
  destinationWarehouse: WarehouseLabel | null;
  memo: string;
  source: "database" | "sample";
};

function sampleMovementRows(
  q = "",
  type?: StockMovementKind,
  warehouse?: WarehouseKind,
  warehouses?: readonly WarehouseOption[]
): MovementRow[] {
  const query = q.trim().toLocaleLowerCase("ko-KR");
  const typeLabel = type ? stockMovementTypeLabel(type) : undefined;

  return movements.map((movement) => {
    const allergen = findAllergen(movement.allergenId);

    return {
      id: String(movement.id),
      date: movement.date,
      type: movement.type,
      allergenName: allergen?.name ?? "-",
      allergenCode: allergen?.code ?? "-",
      lotNo: movement.lotNo,
      quantity: movement.quantity,
      warehouse: warehouseLabel(movement.warehouse ?? "FINISHED_GOODS", warehouses),
      destinationWarehouse: movement.destinationWarehouse
        ? warehouseLabel(movement.destinationWarehouse, warehouses)
        : null,
      memo: movement.memo,
      source: "sample" as const
    };
  }).filter((movement) => {
    if (typeLabel && movement.type !== typeLabel) return false;
    if (
      warehouse &&
      movement.warehouse !== warehouseLabel(warehouse, warehouses) &&
      movement.destinationWarehouse !== warehouseLabel(warehouse, warehouses)
    ) return false;
    if (!query) return true;

    return [
      movement.allergenName,
      movement.allergenCode,
      movement.lotNo,
      movement.memo
    ].some((value) => value.toLocaleLowerCase("ko-KR").includes(query));
  });
}

export async function getMovementRows(
  page: number,
  q = "",
  type?: StockMovementKind,
  warehouse?: WarehouseKind,
  warehouses?: readonly WarehouseOption[]
): Promise<PaginatedResult<MovementRow>> {
  try {
    const where = buildMovementWhere({ q, type, warehouse });
    const requestedSkip = (Math.max(1, page) - 1) * PAGE_SIZE;
    const movementQuery = {
      where,
      select: {
        id: true,
        createdAt: true,
        type: true,
        quantity: true,
        warehouse: true,
        destinationWarehouse: true,
        reason: true,
        reagentLot: {
          select: {
            lotNo: true,
            allergen: {
              select: {
                name: true,
                code: true
              }
            }
          }
        }
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ], skip: requestedSkip, take: PAGE_SIZE
    } satisfies Prisma.StockMovementFindManyArgs;
    const [total, initialMovements] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany(movementQuery)
    ]);
    const meta = pageMeta(page, total);
    const dbMovements = meta.skip === requestedSkip
      ? initialMovements
      : await prisma.stockMovement.findMany({ ...movementQuery, skip: meta.skip });

    return { ...meta, rows: dbMovements.map((movement) => ({
      id: movement.id,
      date: koreaDateKey(movement.createdAt),
      type: stockMovementTypeLabel(movement.type),
      allergenName: movement.reagentLot.allergen.name,
      allergenCode: movement.reagentLot.allergen.code,
      lotNo: movement.reagentLot.lotNo,
      quantity: movement.quantity,
      warehouse: warehouseLabel(movement.warehouse, warehouses),
      destinationWarehouse: movement.destinationWarehouse
        ? warehouseLabel(movement.destinationWarehouse, warehouses)
        : null,
      memo: movement.reason ?? "-",
      source: "database"
    })) };
  } catch (error) {
    return handleDataSourceError(
      "movements",
      error,
      () => paginateRows(sampleMovementRows(q, type, warehouse, warehouses), page)
    );
  }
}

export function movementSourceLabel(rows: MovementRow[]) {
  const source = rows[0]?.source ?? "database";

  if (source === "database") {
    return "최신 정보";
  }

  return "예시 정보";
}

export { formatDate };
