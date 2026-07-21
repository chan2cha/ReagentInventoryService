-- Replace legacy contact/address fields with the client-management fields
-- used for delivery operations. Preserve the existing address's broad region.
ALTER TABLE "Client"
  ADD COLUMN "region" TEXT,
  ADD COLUMN "deliveryDepartment" TEXT;

UPDATE "Client"
SET "region" = NULLIF(
  CONCAT_WS(' ', SPLIT_PART(COALESCE("address", ''), ' ', 1), SPLIT_PART(COALESCE("address", ''), ' ', 2)),
  ''
);

ALTER TABLE "Client"
  DROP COLUMN "phone",
  DROP COLUMN "address";
