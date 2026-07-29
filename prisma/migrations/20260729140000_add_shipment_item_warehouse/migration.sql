-- Preserve the actual source warehouse on every shipped LOT. Historical
-- shipment items predate multi-warehouse shipment allocation and therefore
-- came from the finished-goods warehouse.
ALTER TABLE "ShipmentItem"
  ADD COLUMN "warehouse" TEXT NOT NULL DEFAULT 'FINISHED_GOODS';

CREATE INDEX "ShipmentItem_warehouse_idx"
  ON "ShipmentItem"("warehouse");

CREATE INDEX "ShipmentItem_reagentLotId_warehouse_idx"
  ON "ShipmentItem"("reagentLotId", "warehouse");
