ALTER TABLE "User"
    ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    ADD CONSTRAINT "User_sessionVersion_positive_check" CHECK ("sessionVersion" > 0);
