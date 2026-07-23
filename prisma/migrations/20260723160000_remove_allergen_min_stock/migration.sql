ALTER TABLE "Allergen" DROP CONSTRAINT IF EXISTS "Allergen_minStock_nonnegative_check";
ALTER TABLE "Allergen" DROP COLUMN IF EXISTS "minStock";
