BEGIN;

CREATE TYPE "ShipmentPurpose" AS ENUM ('ORDER', 'REPLACEMENT');
CREATE TYPE "ReplacementStatus" AS ENUM ('CONFIRMED', 'COMPLETED', 'EXCLUDED');
CREATE TYPE "ReturnDisposition" AS ENUM ('COLLECTED_DISPOSED', 'CLIENT_DISPOSED', 'NOT_COLLECTED');

ALTER TABLE "Shipment" ADD COLUMN "purpose" "ShipmentPurpose" NOT NULL DEFAULT 'ORDER';
DROP INDEX "Shipment_one_shipped_per_order_key";
CREATE UNIQUE INDEX "Shipment_one_shipped_per_order_key" ON "Shipment"("orderId")
  WHERE "status" = 'SHIPPED'::"ShipmentStatus" AND "purpose" = 'ORDER'::"ShipmentPurpose";

CREATE TABLE "Replacement" (
  "id" TEXT NOT NULL,
  "replacementNo" TEXT NOT NULL,
  "originalShipmentItemId" TEXT NOT NULL,
  "confirmedQuantity" INTEGER NOT NULL,
  "status" "ReplacementStatus" NOT NULL DEFAULT 'CONFIRMED',
  "returnDisposition" "ReturnDisposition",
  "exclusionReason" TEXT,
  "replacementShipmentId" TEXT,
  "createdBy" TEXT NOT NULL,
  "completedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Replacement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Replacement_quantity_positive_check" CHECK ("confirmedQuantity" > 0),
  CONSTRAINT "Replacement_exclusion_reason_check" CHECK ("status" <> 'EXCLUDED' OR char_length(btrim("exclusionReason")) > 0)
);
CREATE UNIQUE INDEX "Replacement_replacementNo_key" ON "Replacement"("replacementNo");
CREATE UNIQUE INDEX "Replacement_originalShipmentItemId_key" ON "Replacement"("originalShipmentItemId");
CREATE UNIQUE INDEX "Replacement_replacementShipmentId_key" ON "Replacement"("replacementShipmentId");
CREATE INDEX "Replacement_status_createdAt_idx" ON "Replacement"("status", "createdAt");
CREATE INDEX "Replacement_createdBy_idx" ON "Replacement"("createdBy");
CREATE INDEX "Replacement_completedBy_idx" ON "Replacement"("completedBy");
ALTER TABLE "Replacement" ADD CONSTRAINT "Replacement_originalShipmentItemId_fkey" FOREIGN KEY ("originalShipmentItemId") REFERENCES "ShipmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Replacement" ADD CONSTRAINT "Replacement_replacementShipmentId_fkey" FOREIGN KEY ("replacementShipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Replacement" ADD CONSTRAINT "Replacement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Replacement" ADD CONSTRAINT "Replacement_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
