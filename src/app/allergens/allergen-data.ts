import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { allergens } from "../reagent-data";

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

export async function getAllergenRows(): Promise<AllergenRow[]> {
  try {
    const dbAllergens = await prisma.allergen.findMany({
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
      ]
    });

    return dbAllergens.map((allergen) => ({
      id: allergen.id,
      code: allergen.code,
      name: allergen.name,
      category: allergen.category ?? "-",
      minStock: allergen.minStock,
      active: allergen.isActive,
      lotCount: allergen._count.lots,
      source: "database"
    }));
  } catch (error) {
    return handleDataSourceError("allergens", error, sampleAllergenRows);
  }
}

export function allergenSourceLabel(rows: AllergenRow[]) {
  const source = rows[0]?.source ?? "database";

  if (source === "database") {
    return "최신 정보";
  }

  return "예시 정보";
}
