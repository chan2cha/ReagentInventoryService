-- Track whether an order was entered by a user or generated for a stock shortage,
-- and whether an outbound shipment fulfilled the whole order.
CREATE TYPE "OrderOrigin" AS ENUM ('MANUAL', 'SHORTAGE_REORDER');
CREATE TYPE "ShipmentFulfillmentStatus" AS ENUM ('NORMAL', 'PARTIAL');

ALTER TABLE "Order"
  ADD COLUMN "origin" "OrderOrigin" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "shortageFromShipmentId" TEXT;

ALTER TABLE "Shipment"
  ADD COLUMN "fulfillmentStatus" "ShipmentFulfillmentStatus" NOT NULL DEFAULT 'NORMAL';

CREATE UNIQUE INDEX "Order_shortageFromShipmentId_key" ON "Order"("shortageFromShipmentId");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_shortageFromShipmentId_fkey"
  FOREIGN KEY ("shortageFromShipmentId") REFERENCES "Shipment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
