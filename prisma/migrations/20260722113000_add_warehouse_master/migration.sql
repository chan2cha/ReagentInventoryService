-- Warehouse codes were originally a PostgreSQL enum. Convert the stored values
-- to text so administrators can maintain the warehouse master without a deploy.
ALTER TABLE "WarehouseStock"
  ALTER COLUMN "warehouse" DROP DEFAULT,
  ALTER COLUMN "warehouse" TYPE TEXT USING "warehouse"::text;

ALTER TABLE "StockMovement"
  ALTER COLUMN "warehouse" DROP DEFAULT,
  ALTER COLUMN "warehouse" TYPE TEXT USING "warehouse"::text,
  ALTER COLUMN "destinationWarehouse" TYPE TEXT USING "destinationWarehouse"::text,
  ALTER COLUMN "warehouse" SET DEFAULT 'FINISHED_GOODS';

DROP TYPE "Warehouse";

CREATE TABLE "Warehouse" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");
CREATE INDEX "Warehouse_name_idx" ON "Warehouse"("name");

INSERT INTO "Warehouse" ("id", "code", "name", "updatedAt") VALUES
  ('warehouse_finished_goods', 'FINISHED_GOODS', '완제품', CURRENT_TIMESTAMP),
  ('warehouse_sample', 'SAMPLE', '검체', CURRENT_TIMESTAMP),
  ('warehouse_returned', 'RETURNED', '반품', CURRENT_TIMESTAMP),
  ('warehouse_nonconforming', 'NONCONFORMING', '부적합', CURRENT_TIMESTAMP),
  ('warehouse_disposal', 'DISPOSAL', '폐기', CURRENT_TIMESTAMP);
