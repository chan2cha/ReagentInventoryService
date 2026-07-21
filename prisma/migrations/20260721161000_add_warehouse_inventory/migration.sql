-- Move the mutable inventory balance out of ReagentLot so one LOT can be split
-- across warehouses without duplicating its identity or shipment history.
BEGIN;

-- Block legacy application writes for the full cutover. Without taking these
-- locks before the backfill, a currentQuantity update or a newly inserted LOT
-- could land after its balance was copied and be lost when the column is dropped.
LOCK TABLE "ReagentLot" IN ACCESS EXCLUSIVE MODE;
LOCK TABLE "StockMovement" IN ACCESS EXCLUSIVE MODE;

CREATE TYPE "Warehouse" AS ENUM (
    'FINISHED_GOODS',
    'SAMPLE',
    'RETURNED',
    'NONCONFORMING',
    'DISPOSAL'
);

CREATE TABLE "WarehouseStock" (
    "reagentLotId" TEXT NOT NULL,
    "warehouse" "Warehouse" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseStock_pkey" PRIMARY KEY ("reagentLotId", "warehouse"),
    CONSTRAINT "WarehouseStock_quantity_nonnegative_check" CHECK ("quantity" >= 0)
);

ALTER TABLE "WarehouseStock"
    ADD CONSTRAINT "WarehouseStock_reagentLotId_fkey"
    FOREIGN KEY ("reagentLotId") REFERENCES "ReagentLot"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "WarehouseStock_warehouse_quantity_idx"
    ON "WarehouseStock"("warehouse", "quantity");

-- Historical data has no warehouse dimension. Preserve every current balance,
-- including zero balances, in the default finished-goods warehouse.
INSERT INTO "WarehouseStock" (
    "reagentLotId",
    "warehouse",
    "quantity",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    'FINISHED_GOODS'::"Warehouse",
    "currentQuantity",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "ReagentLot";

ALTER TABLE "StockMovement"
    ADD COLUMN "warehouse" "Warehouse" NOT NULL DEFAULT 'FINISHED_GOODS',
    ADD COLUMN "destinationWarehouse" "Warehouse";

CREATE INDEX "StockMovement_warehouse_createdAt_idx"
    ON "StockMovement"("warehouse", "createdAt");

CREATE INDEX "StockMovement_destinationWarehouse_createdAt_idx"
    ON "StockMovement"("destinationWarehouse", "createdAt");

ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_transfer_shape_check" CHECK (
        (
            "type" = 'TRANSFER'::"StockMovementType"
            AND "quantity" > 0
            AND "destinationWarehouse" IS NOT NULL
            AND "warehouse" <> "destinationWarehouse"
        )
        OR
        (
            "type" <> 'TRANSFER'::"StockMovementType"
            AND "destinationWarehouse" IS NULL
        )
    );

-- Refuse to remove the legacy source column unless every LOT was copied exactly.
DO $$
DECLARE
    mismatch_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO mismatch_count
    FROM "ReagentLot" AS lot
    LEFT JOIN "WarehouseStock" AS stock
      ON stock."reagentLotId" = lot."id"
     AND stock."warehouse" = 'FINISHED_GOODS'::"Warehouse"
    WHERE stock."reagentLotId" IS NULL
       OR stock."quantity" <> lot."currentQuantity";

    IF mismatch_count > 0 THEN
        RAISE EXCEPTION 'Warehouse inventory cutover failed: % ReagentLot balance(s) were not copied exactly', mismatch_count;
    END IF;
END $$;

DROP INDEX "ReagentLot_currentQuantity_idx";

ALTER TABLE "ReagentLot"
    DROP CONSTRAINT "ReagentLot_currentQuantity_nonnegative_check",
    DROP COLUMN "currentQuantity";

COMMIT;
