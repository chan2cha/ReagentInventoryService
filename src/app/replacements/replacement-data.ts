import { prisma } from "@/lib/prisma";
import { addDateOnlyDays, daysUntilDateOnly, koreaDateKey } from "@/lib/date";
import { getReplacementPolicy } from "@/services/replacement-service";

export async function getReplacementData() {
  const policy = await getReplacementPolicy(prisma);
  const threshold = addDateOnlyDays(koreaDateKey(), policy.detectionDays);
  const candidates = await prisma.shipmentItem.findMany({ where: {
    shipment: { status: "SHIPPED", purpose: "ORDER" },
    reagentLot: { expirationDate: { lte: threshold } },
    replacement: { is: null }
  }, include: {
    shipment: { include: { order: { include: { client: true } } } },
    reagentLot: { include: { allergen: true } }
  }, orderBy: [{ reagentLot: { expirationDate: "asc" } }, { id: "asc" }], take: 200 });

  const manualCandidates = await prisma.shipmentItem.findMany({ where: {
    shipment: { status: "SHIPPED", purpose: "ORDER" },
    replacement: { is: null }
  }, include: {
    shipment: { include: { order: { include: { client: true } } } },
    reagentLot: { include: { allergen: true } }
  }, orderBy: [{ shipment: { shippedAt: "desc" } }, { id: "asc" }], take: 500 });

  const replacements = await prisma.replacement.findMany({ include: {
    originalShipmentItem: { include: {
      shipment: { include: { order: { include: { client: true } } } },
      reagentLot: { include: { allergen: true } }
    } }, replacementShipment: { include: { items: { include: { reagentLot: true } } } }
  }, orderBy: [{ createdAt: "desc" }], take: 200 });

  return {
    policy: { detectionDays: policy.detectionDays, minimumShelfLifeDays: policy.minimumDeliveryShelfDays },
    candidates: candidates.map((item) => ({
      id: item.id, clientName: item.shipment.order.client.name, orderNo: item.shipment.order.orderNo,
      allergenCode: item.reagentLot.allergen.code, allergenName: item.reagentLot.allergen.name,
      lotNo: item.reagentLot.lotNo, expirationDate: item.reagentLot.expirationDate,
      daysRemaining: daysUntilDateOnly(item.reagentLot.expirationDate), shippedQuantity: item.quantity
    })),
    manualCandidates: manualCandidates.map((item) => ({
      id: item.id, clientName: item.shipment.order.client.name, orderNo: item.shipment.order.orderNo,
      allergenCode: item.reagentLot.allergen.code, allergenName: item.reagentLot.allergen.name,
      lotNo: item.reagentLot.lotNo, shippedQuantity: item.quantity
    })),
    replacements: replacements.map((row) => ({
      id: row.id, replacementNo: row.replacementNo, status: row.status, origin: row.origin, reason: row.reason,
      clientName: row.originalShipmentItem.shipment.order.client.name,
      allergenName: row.originalShipmentItem.reagentLot.allergen.name,
      originalLotNo: row.originalShipmentItem.reagentLot.lotNo,
      quantity: row.confirmedQuantity, disposition: row.returnDisposition,
      exclusionReason: row.exclusionReason, createdAt: row.createdAt,
      replacementLots: row.replacementShipment?.items.map((item) => item.reagentLot.lotNo).join(", ") ?? "-"
    }))
  };
}
