-- Reject legacy data that would make the new constraints or unique indexes fail.
-- Keeping this preflight inside the transaction makes the migration all-or-nothing.
BEGIN;

DO $$
DECLARE
    violation_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO violation_count
    FROM "ReagentLot"
    WHERE "currentQuantity" < 0;

    IF violation_count > 0 THEN
        RAISE EXCEPTION 'Inventory invariant preflight failed: % ReagentLot row(s) have currentQuantity < 0', violation_count;
    END IF;

    SELECT COUNT(*) INTO violation_count
    FROM "ReagentLot"
    WHERE "initialQuantity" <= 0;

    IF violation_count > 0 THEN
        RAISE EXCEPTION 'Inventory invariant preflight failed: % ReagentLot row(s) have initialQuantity <= 0', violation_count;
    END IF;

    SELECT COUNT(*) INTO violation_count
    FROM "ReagentLot"
    WHERE "expirationDate" <= "receivedDate";

    IF violation_count > 0 THEN
        RAISE EXCEPTION 'Inventory invariant preflight failed: % ReagentLot row(s) have expirationDate <= receivedDate', violation_count;
    END IF;

    SELECT COUNT(*) INTO violation_count
    FROM "Allergen"
    WHERE "minStock" < 0;

    IF violation_count > 0 THEN
        RAISE EXCEPTION 'Inventory invariant preflight failed: % Allergen row(s) have minStock < 0', violation_count;
    END IF;

    SELECT COUNT(*) INTO violation_count
    FROM "OrderItem"
    WHERE "quantity" <= 0;

    IF violation_count > 0 THEN
        RAISE EXCEPTION 'Inventory invariant preflight failed: % OrderItem row(s) have quantity <= 0', violation_count;
    END IF;

    SELECT COUNT(*) INTO violation_count
    FROM "ShipmentItem"
    WHERE "quantity" <= 0;

    IF violation_count > 0 THEN
        RAISE EXCEPTION 'Inventory invariant preflight failed: % ShipmentItem row(s) have quantity <= 0', violation_count;
    END IF;

    SELECT COUNT(*) INTO violation_count
    FROM "StockMovement"
    WHERE "quantity" = 0;

    IF violation_count > 0 THEN
        RAISE EXCEPTION 'Inventory invariant preflight failed: % StockMovement row(s) have quantity = 0', violation_count;
    END IF;

    SELECT COUNT(*) INTO violation_count
    FROM (
        SELECT 1
        FROM "OrderItem"
        GROUP BY "orderId", "allergenId"
        HAVING COUNT(*) > 1
    ) AS duplicate_order_items;

    IF violation_count > 0 THEN
        RAISE EXCEPTION 'Inventory invariant preflight failed: % duplicate OrderItem (orderId, allergenId) group(s) exist', violation_count;
    END IF;

    SELECT COUNT(*) INTO violation_count
    FROM (
        SELECT 1
        FROM "Shipment"
        WHERE "status" = 'SHIPPED'::"ShipmentStatus"
        GROUP BY "orderId"
        HAVING COUNT(*) > 1
    ) AS duplicate_active_shipments;

    IF violation_count > 0 THEN
        RAISE EXCEPTION 'Inventory invariant preflight failed: % order(s) have more than one SHIPPED Shipment', violation_count;
    END IF;
END $$;

ALTER TABLE "ReagentLot"
    ADD CONSTRAINT "ReagentLot_currentQuantity_nonnegative_check" CHECK ("currentQuantity" >= 0),
    ADD CONSTRAINT "ReagentLot_initialQuantity_positive_check" CHECK ("initialQuantity" > 0),
    ADD CONSTRAINT "ReagentLot_expiration_after_received_check" CHECK ("expirationDate" > "receivedDate");

ALTER TABLE "Allergen"
    ADD CONSTRAINT "Allergen_minStock_nonnegative_check" CHECK ("minStock" >= 0);

ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_quantity_positive_check" CHECK ("quantity" > 0);

ALTER TABLE "ShipmentItem"
    ADD CONSTRAINT "ShipmentItem_quantity_positive_check" CHECK ("quantity" > 0);

ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_quantity_nonzero_check" CHECK ("quantity" <> 0);

CREATE INDEX "Order_clientId_idx" ON "Order"("clientId");

CREATE UNIQUE INDEX "OrderItem_orderId_allergenId_key"
    ON "OrderItem"("orderId", "allergenId");
CREATE INDEX "OrderItem_allergenId_idx" ON "OrderItem"("allergenId");

CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");
CREATE UNIQUE INDEX "Shipment_one_shipped_per_order_key"
    ON "Shipment"("orderId")
    WHERE "status" = 'SHIPPED'::"ShipmentStatus";

CREATE INDEX "ShipmentItem_shipmentId_idx" ON "ShipmentItem"("shipmentId");
CREATE INDEX "ShipmentItem_reagentLotId_idx" ON "ShipmentItem"("reagentLotId");

CREATE INDEX "StockMovement_reagentLotId_idx" ON "StockMovement"("reagentLotId");
CREATE INDEX "StockMovement_createdBy_idx" ON "StockMovement"("createdBy");

COMMIT;
