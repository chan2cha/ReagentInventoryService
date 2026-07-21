-- PostgreSQL cannot safely use a newly-added enum value before the transaction
-- that adds it commits. Keep this migration separate from the warehouse cutover.
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER';
