import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { allergens } from "../reagent-data";
import { PAGE_SIZE,pageMeta,paginateRows,type PaginatedResult } from "@/lib/pagination";

export type AllergenRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  minStock: number | null;
  active: boolean;
  lotCount: number;
  source: "database" | "sample";
};

function sampleAllergenRows(): AllergenRow[] {
  return allergens.map((allergen) => ({
    id: String(allergen.id),
    code: allergen.code,
    name: allergen.name,
    category: allergen.category,
    minStock: allergen.minStock,
    active: allergen.active,
    lotCount: 0,
    source: "sample"
  }));
}

export async function getAllergenRows(page:number, q = ""): Promise<PaginatedResult<AllergenRow>> {
  try {
    const where = q ? { OR: [
      { code: { contains: q, mode: "insensitive" as const } },
      { name: { contains: q, mode: "insensitive" as const } },
      { category: { contains: q, mode: "insensitive" as const } }
    ] } : {};
    const total=await prisma.allergen.count({ where }); const meta=pageMeta(page,total); const dbAllergens = await prisma.allergen.findMany({
      where,
      include: {
        _count: {
          select: {
            lots: true
          }
        }
      },
      orderBy: [
        { category: "asc" },
        { code: "asc" }
      ],skip:meta.skip,take:PAGE_SIZE
    });

    return {...meta,rows:dbAllergens.map((allergen) => ({
      id: allergen.id,
      code: allergen.code,
      name: allergen.name,
      category: allergen.category ?? "-",
      minStock: allergen.minStock,
      active: allergen.isActive,
      lotCount: allergen._count.lots,
      source: "database"
    }))};
  } catch (error) {
    return handleDataSourceError("allergens", error,()=>paginateRows(sampleAllergenRows(),page));
  }
}

export function allergenSourceLabel(rows: AllergenRow[]) {
  const source = rows[0]?.source ?? "database";

  if (source === "database") {
    return "최신 정보";
  }

  return "예시 정보";
}
