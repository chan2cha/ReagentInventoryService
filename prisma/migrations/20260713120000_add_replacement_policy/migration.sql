BEGIN;

CREATE TABLE "ReplacementPolicy" (
  "id" TEXT NOT NULL,
  "detectionDays" INTEGER NOT NULL,
  "minimumDeliveryShelfDays" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReplacementPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReplacementPolicy_detectionDays_positive_check" CHECK ("detectionDays" > 0),
  CONSTRAINT "ReplacementPolicy_minimumDeliveryShelfDays_positive_check" CHECK ("minimumDeliveryShelfDays" > 0)
);

INSERT INTO "ReplacementPolicy" ("id", "detectionDays", "minimumDeliveryShelfDays", "updatedAt")
VALUES ('default', 60, 180, CURRENT_TIMESTAMP);

COMMIT;
