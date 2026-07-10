import { prisma } from "@/lib/prisma";
import { handleDataSourceError } from "@/lib/data-source";

export type OrderFormClient = {
  id: string;
  name: string;
  manager: string;
};

export type OrderFormAllergen = {
  id: string;
  code: string;
  name: string;
};

export async function getOrderFormData(): Promise<{
  clients: OrderFormClient[];
  allergens: OrderFormAllergen[];
}> {
  try {
    const [clients, allergens] = await Promise.all([
      prisma.client.findMany({
        where: {
          isActive: true
        },
        orderBy: {
          name: "asc"
        }
      }),
      prisma.allergen.findMany({
        where: {
          isActive: true
        },
        orderBy: [
          { category: "asc" },
          { code: "asc" }
        ]
      })
    ]);

    return {
      clients: clients.map((client) => ({
        id: client.id,
        name: client.name,
        manager: client.managerName ?? "-"
      })),
      allergens: allergens.map((allergen) => ({
        id: allergen.id,
        code: allergen.code,
        name: allergen.name
      }))
    };
  } catch (error) {
    return handleDataSourceError("order-form", error, () => ({
      clients: [],
      allergens: []
    }));
  }
}
