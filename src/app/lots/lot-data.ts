import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { daysUntilDateOnly } from "@/lib/date";
import { findAllergen, formatDate, lotStatus, lots } from "../reagent-data";
import { PAGE_SIZE, pageMeta, paginateRows, type PaginatedResult } from "@/lib/pagination";

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
  status: "정상" | "재고부족" | "품절" | "유통기한 임박" | "유통기한 만료";
  source: "database" | "sample";
};

function statusFromDbLot(lot: {
  currentQuantity: number;
  expirationDate: Date;
  allergen: {
    minStock: number;
  };
}): LotRow["status"] {
  const days = daysUntilDateOnly(lot.expirationDate);

  if (days < 0) return "유통기한 만료";
  if (lot.currentQuantity === 0) return "품절";
  if (days <= 30) return "유통기한 임박";
  if (lot.allergen.minStock > 0 && lot.currentQuantity < lot.allergen.minStock) return "재고부족";
  return "정상";
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sampleLotRows(): LotRow[] {
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
        status: lotStatus(lot),
        source: "sample" as const
      };
    })
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
}

export async function getLotRows(page: number, q = ""): Promise<PaginatedResult<LotRow>> {
  try {
    const where = q ? { OR: [
      { lotNo: { contains: q, mode: "insensitive" as const } },
      { allergen: { is: { name: { contains: q, mode: "insensitive" as const } } } },
      { allergen: { is: { code: { contains: q, mode: "insensitive" as const } } } }
    ] } : {};
    const total=await prisma.reagentLot.count({ where }); const meta=pageMeta(page,total); const dbLots = await prisma.reagentLot.findMany({
      where,
      include: {
        allergen: true
      },
      orderBy: [
        { expirationDate: "asc" },
        { lotNo: "asc" }
      ], skip:meta.skip, take:PAGE_SIZE
    });

    return { ...meta, rows: dbLots.map((lot) => ({
      id: lot.id,
      allergenName: lot.allergen.name,
      allergenCode: lot.allergen.code,
      lotNo: lot.lotNo,
      receivedDate: toDateInput(lot.receivedDate),
      expirationDate: toDateInput(lot.expirationDate),
      currentQuantity: lot.currentQuantity,
      initialQuantity: lot.initialQuantity,
      minStock: lot.allergen.minStock,
      status: statusFromDbLot(lot),
      source: "database"
    })) };
  } catch (error) {
    return handleDataSourceError("lots", error, () => paginateRows(sampleLotRows(),page));
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
