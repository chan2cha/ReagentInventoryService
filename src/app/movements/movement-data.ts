import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { koreaDateKey } from "@/lib/date";
import { findAllergen, formatDate, movements, type MovementType } from "../reagent-data";

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

export async function getMovementRows(): Promise<MovementRow[]> {
  try {
    const dbMovements = await prisma.stockMovement.findMany({
      include: {
        reagentLot: {
          include: {
            allergen: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return dbMovements.map((movement) => ({
      id: movement.id,
      date: koreaDateKey(movement.createdAt),
      type: mapMovementType(movement.type),
      allergenName: movement.reagentLot.allergen.name,
      allergenCode: movement.reagentLot.allergen.code,
      lotNo: movement.reagentLot.lotNo,
      quantity: movement.quantity,
      memo: movement.reason ?? "-",
      source: "database"
    }));
  } catch (error) {
    return handleDataSourceError("movements", error, sampleMovementRows);
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
