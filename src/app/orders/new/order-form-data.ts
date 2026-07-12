import { handleDataSourceError } from "@/lib/data-source";
import { prisma } from "@/lib/prisma";
import { listActiveOrderTemplates } from "@/services/order-template-service";

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

export type OrderFormTemplate = {
  id: string;
  name: string;
  description: string | null;
  items: Array<{
    allergenId: string;
    quantity: number;
    allergen: OrderFormAllergen & {
      isActive: boolean;
    };
  }>;
};

async function getManualOrderFormData(): Promise<{
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

async function getOrderFormTemplates(): Promise<{
  templates: OrderFormTemplate[];
  templateLoadFailed: boolean;
}> {
  try {
    const templates = await listActiveOrderTemplates(prisma);

    return {
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        items: template.items.map((item) => ({
          allergenId: item.allergenId,
          quantity: item.quantity,
          allergen: item.allergen
        }))
      })),
      templateLoadFailed: false
    };
  } catch (error) {
    console.error("[data-source:order-form-templates] database query failed", error);
    return {
      templates: [],
      templateLoadFailed: true
    };
  }
}

export async function getOrderFormData(): Promise<{
  clients: OrderFormClient[];
  allergens: OrderFormAllergen[];
  templates: OrderFormTemplate[];
  templateLoadFailed: boolean;
}> {
  const [manualOrderFormData, templateData] = await Promise.all([
    getManualOrderFormData(),
    getOrderFormTemplates()
  ]);

  return {
    ...manualOrderFormData,
    ...templateData
  };
}
