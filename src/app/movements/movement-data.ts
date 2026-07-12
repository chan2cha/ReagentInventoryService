import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { koreaDateKey } from "@/lib/date";
import { buildMovementWhere } from "@/domain/export-filters";
import {
  stockMovementTypeLabel,
  type StockMovementKind,
  type StockMovementLabel
} from "@/domain/stock-movement-presentation";
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
  memo: string;
  source: "database" | "sample";
};

function sampleMovementRows(q = "", type?: StockMovementKind): MovementRow[] {
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
      memo: movement.memo,
      source: "sample" as const
    };
  }).filter((movement) => {
    if (typeLabel && movement.type !== typeLabel) return false;
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
  type?: StockMovementKind
): Promise<PaginatedResult<MovementRow>> {
  try {
    const where = buildMovementWhere({ q, type });
    const total = await prisma.stockMovement.count({ where }); const meta = pageMeta(page, total);
    const dbMovements = await prisma.stockMovement.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        type: true,
        quantity: true,
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
      ], skip: meta.skip, take: PAGE_SIZE
    });

    return { ...meta, rows: dbMovements.map((movement) => ({
      id: movement.id,
      date: koreaDateKey(movement.createdAt),
      type: stockMovementTypeLabel(movement.type),
      allergenName: movement.reagentLot.allergen.name,
      allergenCode: movement.reagentLot.allergen.code,
      lotNo: movement.reagentLot.lotNo,
      quantity: movement.quantity,
      memo: movement.reason ?? "-",
      source: "database"
    })) };
  } catch (error) {
    return handleDataSourceError(
      "movements",
      error,
      () => paginateRows(sampleMovementRows(q, type), page)
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
