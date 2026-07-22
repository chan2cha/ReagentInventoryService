import { DEFAULT_WAREHOUSES, type WarehouseOption } from "@/domain/warehouse";
import { prisma } from "@/lib/prisma";

export async function getWarehouseOptions(activeOnly = true): Promise<WarehouseOption[]> {
  try {
    return await prisma.warehouse.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      select: { code: true, name: true },
      orderBy: { name: "asc" }
    });
  } catch (error) {
    console.error("[warehouse-data] warehouse master lookup failed", error);
    return [...DEFAULT_WAREHOUSES];
  }
}

export async function isActiveWarehouse(code: string) {
  const warehouse = await prisma.warehouse.findUnique({
    where: { code },
    select: { id: true, isActive: true }
  });
  return warehouse?.isActive === true;
}
