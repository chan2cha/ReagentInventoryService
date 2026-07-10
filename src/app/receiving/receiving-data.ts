import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";
import { allergens } from "../reagent-data";

export type ReceivingAllergen = {
  id: string;
  code: string;
  name: string;
  category: string;
  source: "database" | "sample";
};

export async function getReceivingAllergens(): Promise<ReceivingAllergen[]> {
  try {
    const dbAllergens = await prisma.allergen.findMany({
      where: {
        isActive: true
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
      source: "database"
    }));
  } catch (error) {
    return handleDataSourceError("receiving", error, () => allergens.map((allergen) => ({
      id: String(allergen.id),
      code: allergen.code,
      name: allergen.name,
      category: allergen.category,
      source: "sample"
    })));
  }
}

export function receivingSourceLabel(rows: ReceivingAllergen[]) {
  const source = rows[0]?.source ?? "database";

  if (source === "database") {
    return "최신 정보";
  }

  return "예시 정보";
}
