BEGIN;

CREATE TYPE "ReplacementOrigin" AS ENUM ('EXPIRY', 'PRODUCT_DEFECT');

ALTER TABLE "Replacement"
  ADD COLUMN "origin" "ReplacementOrigin" NOT NULL DEFAULT 'EXPIRY',
  ADD COLUMN "reason" TEXT;

ALTER TABLE "Replacement"
  ADD CONSTRAINT "Replacement_product_defect_reason_check"
  CHECK (
    "origin" <> 'PRODUCT_DEFECT'::"ReplacementOrigin"
    OR ("reason" IS NOT NULL AND char_length(btrim("reason")) > 0)
  );

CREATE INDEX "Replacement_origin_status_createdAt_idx"
  ON "Replacement"("origin", "status", "createdAt");

COMMIT;
