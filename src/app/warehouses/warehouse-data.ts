import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  stockLotCount: number;
  stockQuantity: number;
  movementCount: number;
};

export async function getWarehouseRows(): Promise<WarehouseRow[]> {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, isActive: true }
  } satisfies Prisma.WarehouseFindManyArgs);

  return Promise.all(warehouses.map(async (warehouse) => {
    const [stock, movementCount] = await Promise.all([
      prisma.warehouseStock.aggregate({
        where: { warehouse: warehouse.code, quantity: { gt: 0 } },
        _count: { _all: true },
        _sum: { quantity: true }
      }),
      prisma.stockMovement.count({
        where: { OR: [{ warehouse: warehouse.code }, { destinationWarehouse: warehouse.code }] }
      })
    ]);
    return {
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      active: warehouse.isActive,
      stockLotCount: stock._count._all,
      stockQuantity: stock._sum.quantity ?? 0,
      movementCount
    };
  }));
}
