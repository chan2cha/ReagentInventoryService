import "server-only";

import { pendingShipmentOrderWhere } from "@/domain/pending-shipment";
import { addDateOnlyDays, koreaDateKey } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { getReplacementPolicy } from "@/services/replacement-service";

export type SidebarData = {
  pendingShipments: number | null;
  replacementCandidates: number | null;
};

export async function getSidebarData(): Promise<SidebarData> {
  try {
    const policy = await getReplacementPolicy(prisma);
    const replacementThreshold = addDateOnlyDays(koreaDateKey(), policy.detectionDays);
    const [pendingShipments, replacementCandidates] = await Promise.all([
      prisma.order.count({ where: pendingShipmentOrderWhere() }),
      prisma.shipmentItem.count({
        where: {
          shipment: { status: "SHIPPED", purpose: "ORDER" },
          reagentLot: { expirationDate: { lte: replacementThreshold } },
          replacement: { is: null }
        }
      })
    ]);

    return { pendingShipments, replacementCandidates };
  } catch (error) {
    console.error("[sidebar-data] sidebar notification count failed", error);
    return { pendingShipments: null, replacementCandidates: null };
  }
}

export function formatSidebarBadge(count: number | null) {
  if (count === null || count < 1) return null;
  return count > 99 ? "99+" : String(count);
}
