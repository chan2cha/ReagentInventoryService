import "server-only";

/** 사이드바 배지는 요청마다 필요한 미처리 업무 건수만 가볍게 집계한다. */

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
    const [policy, pendingShipments] = await Promise.all([
      getReplacementPolicy(prisma),
      prisma.order.count({ where: pendingShipmentOrderWhere() })
    ]);
    const replacementThreshold = addDateOnlyDays(koreaDateKey(), policy.detectionDays);
    const replacementCandidates = await prisma.shipmentItem.count({
      where: {
        shipment: { status: "SHIPPED", purpose: "ORDER" },
        reagentLot: { expirationDate: { lte: replacementThreshold } },
        replacement: { is: null }
      }
    });

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
