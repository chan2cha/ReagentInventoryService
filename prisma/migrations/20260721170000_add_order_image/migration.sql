CREATE TABLE "OrderImage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderImage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderImage_fileName_length_check" CHECK (char_length("fileName") BETWEEN 1 AND 255),
    CONSTRAINT "OrderImage_contentType_check" CHECK ("contentType" IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT "OrderImage_byteSize_check" CHECK ("byteSize" BETWEEN 1 AND 3145728),
    CONSTRAINT "OrderImage_data_size_check" CHECK (octet_length("data") = "byteSize")
);

CREATE UNIQUE INDEX "OrderImage_orderId_key" ON "OrderImage"("orderId");

ALTER TABLE "OrderImage"
    ADD CONSTRAINT "OrderImage_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
