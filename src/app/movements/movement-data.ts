import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { koreaDateKey } from "@/lib/date";
import { findAllergen, formatDate, movements, type MovementType } from "../reagent-data";
import { PAGE_SIZE, pageMeta, paginateRows, type PaginatedResult } from "@/lib/pagination";

export type MovementRow = {
  id: string;
  date: string;
  type: MovementType;
  allergenName: string;
  allergenCode: string;
  lotNo: string;
  quantity: number;
  memo: string;
  source: "database" | "sample";
};

function mapMovementType(type: "IN" | "OUT" | "ADJUST" | "DISPOSE" | "REVERSE"): MovementType {
  const map = {
    IN: "입고",
    OUT: "출고",
    ADJUST: "조정",
    DISPOSE: "폐기",
    REVERSE: "조정"
  } satisfies Record<typeof type, MovementType>;

  return map[type];
}

function sampleMovementRows(): MovementRow[] {
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
      source: "sample"
    };
  });
}

export async function getMovementRows(page: number, q = ""): Promise<PaginatedResult<MovementRow>> {
  try {
    const where = q ? { OR: [
      { reason: { contains: q, mode: "insensitive" as const } },
      { reagentLot: { is: { lotNo: { contains: q, mode: "insensitive" as const } } } },
      { reagentLot: { is: { allergen: { is: { name: { contains: q, mode: "insensitive" as const } } } } } },
      { reagentLot: { is: { allergen: { is: { code: { contains: q, mode: "insensitive" as const } } } } } }
    ] } : {};
    const total = await prisma.stockMovement.count({ where }); const meta = pageMeta(page, total);
    const dbMovements = await prisma.stockMovement.findMany({
      where,
      include: {
        reagentLot: {
          include: {
            allergen: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }, skip: meta.skip, take: PAGE_SIZE
    });

    return { ...meta, rows: dbMovements.map((movement) => ({
      id: movement.id,
      date: koreaDateKey(movement.createdAt),
      type: mapMovementType(movement.type),
      allergenName: movement.reagentLot.allergen.name,
      allergenCode: movement.reagentLot.allergen.code,
      lotNo: movement.reagentLot.lotNo,
      quantity: movement.quantity,
      memo: movement.reason ?? "-",
      source: "database"
    })) };
  } catch (error) {
    return handleDataSourceError("movements", error, () => paginateRows(sampleMovementRows(), page));
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
