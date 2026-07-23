import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { allergens } from "../reagent-data";
import { PAGE_SIZE,pageMeta,paginateRows,type PaginatedResult } from "@/lib/pagination";

export type AllergenRow = {
  id: string;
  code: string;
  name: string;
  category: string;
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
    const requestedSkip = (Math.max(1, page) - 1) * PAGE_SIZE;
    const allergenQuery = {
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
      ],skip:requestedSkip,take:PAGE_SIZE
    } satisfies Prisma.AllergenFindManyArgs;
    const [total, initialAllergens] = await Promise.all([
      prisma.allergen.count({ where }),
      prisma.allergen.findMany(allergenQuery)
    ]);
    const meta=pageMeta(page,total);
    const dbAllergens = meta.skip === requestedSkip
      ? initialAllergens
      : await prisma.allergen.findMany({ ...allergenQuery, skip: meta.skip });

    return {...meta,rows:dbAllergens.map((allergen) => ({
      id: allergen.id,
      code: allergen.code,
      name: allergen.name,
      category: allergen.category ?? "-",
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
