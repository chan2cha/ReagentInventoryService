import "server-only";

import { pendingShipmentOrderWhere } from "@/domain/pending-shipment";
import { prisma } from "@/lib/prisma";

export type SidebarData = {
  pendingShipments: number | null;
};

export async function getSidebarData(): Promise<SidebarData> {
  try {
    const pendingShipments = await prisma.order.count({
      where: pendingShipmentOrderWhere()
    });

    return { pendingShipments };
  } catch (error) {
    console.error("[sidebar-data] pending shipment count failed", error);
    return { pendingShipments: null };
  }
}

export function formatSidebarBadge(count: number | null) {
  if (count === null || count < 1) return null;
  return count > 99 ? "99+" : String(count);
}
