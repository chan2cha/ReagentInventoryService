BEGIN;

CREATE TABLE "OrderTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderTemplate_name_nonempty_check"
        CHECK (char_length(btrim("name")) BETWEEN 1 AND 100),
    CONSTRAINT "OrderTemplate_nameKey_nonempty_check"
        CHECK (char_length(btrim("nameKey")) BETWEEN 1 AND 100),
    CONSTRAINT "OrderTemplate_description_length_check"
        CHECK ("description" IS NULL OR char_length("description") <= 500),
    CONSTRAINT "OrderTemplate_sortOrder_nonnegative_check"
        CHECK ("sortOrder" >= 0),
    CONSTRAINT "OrderTemplate_version_positive_check"
        CHECK ("version" > 0)
);

CREATE TABLE "OrderTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "OrderTemplateItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderTemplateItem_quantity_positive_check"
        CHECK ("quantity" > 0),
    CONSTRAINT "OrderTemplateItem_position_nonnegative_check"
        CHECK ("position" >= 0)
);

CREATE UNIQUE INDEX "OrderTemplate_nameKey_key"
    ON "OrderTemplate"("nameKey");
CREATE INDEX "OrderTemplate_isActive_sortOrder_name_idx"
    ON "OrderTemplate"("isActive", "sortOrder", "name");
CREATE INDEX "OrderTemplate_createdBy_idx"
    ON "OrderTemplate"("createdBy");
CREATE INDEX "OrderTemplate_updatedBy_idx"
    ON "OrderTemplate"("updatedBy");

CREATE UNIQUE INDEX "OrderTemplateItem_templateId_allergenId_key"
    ON "OrderTemplateItem"("templateId", "allergenId");
CREATE UNIQUE INDEX "OrderTemplateItem_templateId_position_key"
    ON "OrderTemplateItem"("templateId", "position");
CREATE INDEX "OrderTemplateItem_allergenId_idx"
    ON "OrderTemplateItem"("allergenId");

ALTER TABLE "OrderTemplate"
    ADD CONSTRAINT "OrderTemplate_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OrderTemplate_updatedBy_fkey"
        FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderTemplateItem"
    ADD CONSTRAINT "OrderTemplateItem_templateId_fkey"
        FOREIGN KEY ("templateId") REFERENCES "OrderTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "OrderTemplateItem_allergenId_fkey"
        FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
