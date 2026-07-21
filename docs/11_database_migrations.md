# Database Migration Operations

Last updated: 2026-07-12

## Standard Commands

Development schema changes:

```bash
npm run prisma:migrate -- --name describe_the_change
```

Production deployment:

```bash
npm run prisma:migrate:deploy
```

Status check:

```bash
npm run prisma:migrate:status
```

Generate Prisma Client after a schema change:

```bash
npm run prisma:generate
```

## Existing Supabase Baseline

The migration `20260710000000_baseline` represents the schema that was already created in Supabase before Prisma Migrate was introduced. It includes login IDs, forced password changes, minimum stock, and audit logs.

After confirming that the existing database matches `prisma/migrations/20260710000000_baseline/migration.sql`, register the baseline once without executing its table creation SQL. Compare against that baseline migration, not the current `schema.prisma`, because the current schema also includes later forward migrations:

```bash
npx prisma migrate resolve --applied 20260710000000_baseline
npm run prisma:migrate:status
```

Do not run `migrate resolve --applied` on a new empty database. A new database must run `npm run prisma:migrate:deploy`, which creates the full schema.

## Deployment Sequence

1. Create or verify a database backup.
2. Configure runtime `DATABASE_URL` with the transaction pooler and `DIRECT_URL` with the session pooler.
3. Run `npm run prisma:migrate:status`.
4. Run the preflight for every pending data-transforming migration. If the P0 invariant or warehouse cutover is pending, schedule a write-stopped maintenance window.
5. Resolve every reported violation, take and verify another backup, then stop application writes before continuing.
6. Run `npm run prisma:migrate:deploy`.
7. Run `npm run prisma:generate` during the application build.
8. Set a unique temporary `SEED_ADMIN_PASSWORD` of at least 12 characters, set `SEED_DATABASE_TARGET` to the verified `host:port/database?schema=...` derived from `DIRECT_URL`, explicitly set `ALLOW_SAMPLE_DATA=true`, then run `npm run prisma:seed` only for a new approved, non-production environment.
9. Verify login, dashboard reads, inventory by warehouse, one partial transfer, finished-goods-only shipment eligibility, movement history, and export filters. Reopen writes only after reconciliation succeeds.

## P0 Inventory Invariant Migration

Migration `20260712000000_enforce_inventory_invariants` adds database-level protections for inventory quantities, dates, duplicate order items, and duplicate active shipments. It also adds indexes for frequently traversed foreign keys.

The migration runs its own preflight inside a transaction and fails without applying any change when legacy data violates a new invariant. Run these read-only queries separately before deployment so the affected records can be reviewed without waiting for the deployment to fail:

```sql
SELECT 'ReagentLot.currentQuantity < 0' AS violation, COUNT(*) AS row_count
FROM "ReagentLot" WHERE "currentQuantity" < 0
UNION ALL
SELECT 'ReagentLot.initialQuantity <= 0', COUNT(*)
FROM "ReagentLot" WHERE "initialQuantity" <= 0
UNION ALL
SELECT 'ReagentLot.expirationDate <= receivedDate', COUNT(*)
FROM "ReagentLot" WHERE "expirationDate" <= "receivedDate"
UNION ALL
SELECT 'Allergen.minStock < 0', COUNT(*)
FROM "Allergen" WHERE "minStock" < 0
UNION ALL
SELECT 'OrderItem.quantity <= 0', COUNT(*)
FROM "OrderItem" WHERE "quantity" <= 0
UNION ALL
SELECT 'ShipmentItem.quantity <= 0', COUNT(*)
FROM "ShipmentItem" WHERE "quantity" <= 0
UNION ALL
SELECT 'StockMovement.quantity = 0', COUNT(*)
FROM "StockMovement" WHERE "quantity" = 0;

SELECT "orderId", "allergenId", COUNT(*) AS duplicate_count
FROM "OrderItem"
GROUP BY "orderId", "allergenId"
HAVING COUNT(*) > 1;

SELECT "orderId", COUNT(*) AS shipped_count
FROM "Shipment"
WHERE "status" = 'SHIPPED'
GROUP BY "orderId"
HAVING COUNT(*) > 1;
```

Every `row_count` must be `0`, and both duplicate queries must return no rows. Migration deployment intentionally fails when any of the following conditions exists:

- a LOT has negative current quantity, non-positive initial quantity, or an expiration date that is not later than its received date;
- an allergen has negative minimum stock;
- an order item or shipment item has non-positive quantity;
- a stock movement has zero quantity;
- an order contains more than one item for the same allergen;
- an order has more than one `SHIPPED` shipment.

For every non-zero count, retrieve the actual records before correcting anything. These read-only detail queries expose the identifiers and values needed for reconciliation:

```sql
SELECT "id", "lotNo", "currentQuantity", "initialQuantity", "receivedDate", "expirationDate"
FROM "ReagentLot"
WHERE "currentQuantity" < 0
   OR "initialQuantity" <= 0
   OR "expirationDate" <= "receivedDate";

SELECT "id", "code", "minStock"
FROM "Allergen"
WHERE "minStock" < 0;

SELECT "id", "orderId", "allergenId", "quantity"
FROM "OrderItem"
WHERE "quantity" <= 0;

SELECT "id", "shipmentId", "reagentLotId", "quantity"
FROM "ShipmentItem"
WHERE "quantity" <= 0;

SELECT "id", "reagentLotId", "type", "quantity", "refType", "refId"
FROM "StockMovement"
WHERE "quantity" = 0;
```

Do not blindly delete or rewrite violating rows. Reconcile each record against its audit trail and stock movements, document the correction, then rerun the preflight. The CHECK validation and non-concurrent index builds take table locks, so apply this migration in a maintenance window even after the preflight passes.

For a confirmed SQL/preflight failure, the SQL transaction rolls back all schema changes while Prisma records the failed attempt. After correcting and rechecking the legacy data, verify with `prisma:migrate:status` and the database catalog that none of this migration's constraints or indexes were committed. Only then mark that failed attempt as rolled back and deploy it again:

```bash
npx prisma migrate resolve --rolled-back 20260712000000_enforce_inventory_invariants
npm run prisma:migrate:deploy
```

Use `--rolled-back`, not `--applied`, only after confirming that the constraints and indexes were not committed. If the deployment client lost its connection during `COMMIT` or the outcome is otherwise unclear, inspect `_prisma_migrations` and the database objects first; do not resolve an unknown outcome blindly.

The `Shipment_one_shipped_per_order_key` partial unique index and all CHECK constraints are expressed in SQL because Prisma Schema Language cannot represent them. Do not remove them after `prisma db pull`; preserve the migration as the source of truth for these database-only invariants.

## Retired Order Set Migration History

`20260712150000_add_order_templates` is an immutable historical migration. It created `OrderTemplate` and `OrderTemplateItem`, their constraints and indexes, and actor/reagent foreign keys. The migration was applied to real databases, so it must remain committed unchanged even though the feature is no longer part of the current schema. Deleting or editing it would create migration-history drift; it would not remove tables already present in a database.

On 2026-07-12, all migrations then present through `20260712150000_add_order_templates` were applied to the isolated `TEST_DATABASE_URL`, migration status was current, and the database integration suite passed.

The operational database was handled separately: all nine P0 preflight counts were zero, a PostgreSQL custom-format `public` schema backup was created and validated with `pg_restore --list`, and both forward migrations were applied over the verified `:5432` session-pooler connection. Post-deployment migration status was current and the invariant catalog checks passed. The retained local backup is `/Users/chan/Backups/ReagentInventoryService/reagent-operational-pre-migration-20260712T134728Z.dump` with mode `0600` and SHA-256 `71d8d7d77d732b335012b79335c4cd0ca754a4b142f28ac787b0cb5d3e05c508`.

At deployment time the saved local `.env` initially had the pooler ports assigned in reverse (`DATABASE_URL=:5432`, `DIRECT_URL=:6543`). The migration commands used a verified one-process override so no migration ran through the transaction pooler. The values were then corrected to `DATABASE_URL=:6543` and `DIRECT_URL=:5432`; ordinary `prisma:migrate:status` completed over `:5432`, and authenticated read-only checks completed over the normal `:6543` runtime path.

`20260721150000_remove_order_templates` is the required forward removal migration:

- Drop `OrderTemplateItem` before `OrderTemplate` so the child foreign keys are removed in dependency order.
- Treat the operation as destructive to the retired feature's stored rows and take the standard verified backup first.
- Ordinary `Order` and `OrderItem` data are unaffected because they never referenced either retired table.
- Existing order-set-related `AuditLog` rows remain as generic historical records; `AuditLog.entityType` and `entityId` are strings without foreign keys to the removed tables.
- A fresh database still runs the historical add migration and then this removal migration in order, producing the same current schema without rewriting migration history.

Before deployment, confirm the target, backup, and `prisma:migrate:status`. Apply the committed migration with `npm run prisma:migrate:deploy`; do not use `migrate resolve --applied` as a substitute for executing it.

After deployment, verify that neither retired table remains:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('OrderTemplate', 'OrderTemplateItem')
ORDER BY table_name;
```

The query must return zero rows, and `prisma:migrate:status` must report no pending or failed migration.

## Warehouse Inventory Cutover

The warehouse feature is delivered by two ordered forward migrations:

- `20260721160000_add_transfer_movement_type` adds PostgreSQL enum value `TRANSFER` and commits it by itself. PostgreSQL must commit a newly added enum value before a following migration safely uses it in a CHECK constraint.
- `20260721161000_add_warehouse_inventory` first takes `ACCESS EXCLUSIVE` locks on `ReagentLot` and `StockMovement`, creates the five-value `Warehouse` enum and `WarehouseStock`, copies every legacy `ReagentLot.currentQuantity` value—including zero—to `FINISHED_GOODS`, verifies the copy, adds movement warehouse fields and shape constraints, then drops the old quantity index, CHECK and column.

`WarehouseStock` keyed by `(reagentLotId, warehouse)` becomes the single mutable quantity source. The table locks prevent legacy writes from racing the backfill and remain held until the transactional migration commits. This is still an application compatibility cutover: the old artifact reads and writes `ReagentLot.currentQuantity` and cannot run after the migration commits.

Before the maintenance window, confirm that the P0 quantity constraint is present and run this read-only preflight:

```sql
SELECT COUNT(*) AS negative_legacy_balances
FROM "ReagentLot"
WHERE "currentQuantity" < 0;

SELECT conname
FROM pg_constraint
WHERE conname = 'ReagentLot_currentQuantity_nonnegative_check';
```

The count must be `0` and the constraint query must return one row. Then use this deployment sequence:

1. Confirm the exact target with `npm run prisma:migrate:status` over `DIRECT_URL`.
2. Create a PostgreSQL backup, validate it with `pg_restore --list`, and record its path and checksum.
3. Stop all application writes and background jobs. Do not allow the old artifact to process receiving, shipment, adjustment, replacement, or transfer requests during cutover.
4. Run `npm run prisma:migrate:deploy`. Both migrations must complete in timestamp order.
5. Run `npm run prisma:generate`, deploy the matching application artifact, and keep writes closed.
6. Run the catalog and reconciliation queries below, then execute the focused application smoke tests.

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ReagentLot'
  AND column_name = 'currentQuantity';

SELECT COUNT(*) AS lots_without_balance
FROM "ReagentLot" AS lot
LEFT JOIN "WarehouseStock" AS stock
  ON stock."reagentLotId" = lot."id"
WHERE stock."reagentLotId" IS NULL;

SELECT COUNT(*) AS negative_warehouse_balances
FROM "WarehouseStock"
WHERE "quantity" < 0;

SELECT COUNT(*) AS invalid_transfers
FROM "StockMovement"
WHERE "type" = 'TRANSFER'::"StockMovementType"
  AND (
    "quantity" <= 0
    OR "destinationWarehouse" IS NULL
    OR "warehouse" = "destinationWarehouse"
  );
```

All four queries must return zero rows or a zero count. Verify a partial move preserves the sum across all warehouses, produces one `TRANSFER` row with both warehouses and one `STOCK_TRANSFER` audit row, and that normal and replacement shipment availability includes only `FINISHED_GOODS`. Moving into `DISPOSAL` must preserve total physical quantity; use the separate disposal action to create `DISPOSE` and remove stock.

Run the final code and database checks before reopening writes:

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm test
npm run build
npm run prisma:migrate:status
npm run test:integration
```

If the first enum migration succeeds but the second migration fails, `TRANSFER` may remain as an unused harmless enum value while the transactional cutover rolls back. Inspect `_prisma_migrations` and the catalog before resolving only the failed second migration as rolled back. If the database cutover succeeds but the new application fails, do not restart the old artifact; either deploy a forward-fixed compatible artifact or restore the verified pre-cutover backup together with the old artifact.

## Session Version Migration

Migration `20260713100000_add_user_session_version` adds a positive integer `User.sessionVersion` with default `1`. Signed login sessions include this value, and authenticated user lookup requires the token version to match the current database value.

- Existing sessions issued before this migration do not contain a version and are rejected after the matching application release.
- Self-service password changes increment the version and issue a replacement session to the current browser.
- Administrator password resets and account deactivation increment the version and revoke every previously issued session for that user.
- Reactivation does not restore an older session because its version remains stale.

On 2026-07-13 this forward-only, additive migration was applied successfully to both the operational Supabase database and the isolated `TEST_DATABASE_URL`. The isolated database then passed all 12 PostgreSQL integration tests. The operational application artifact must include the matching version-aware session code before users log in again.

## Proactive Replacement Migration

Migration `20260713110000_add_proactive_replacements` adds replacement workflow enums, `Shipment.purpose`, and the `Replacement` table. The active-order-shipment partial unique index now applies only to `purpose = ORDER`, allowing traceable replacement shipments without weakening duplicate normal-shipment protection. Positive confirmed quantity, one workflow per original shipment item, unique replacement shipment linkage, actor relations, and required exclusion reasons are enforced in PostgreSQL.

The migration was applied to the isolated `TEST_DATABASE_URL` on 2026-07-13. All 13 integration tests then passed, including confirmation of a client remainder and FEFO shipment from stock meeting the configured minimum shelf life. The operational Supabase database applied the same migration successfully on 2026-07-13, and `prisma migrate status` then reported that the database schema was up to date. Deploy or restart the matching application artifact before using `/replacements` in production.

## Replacement Policy Migration

Migration `20260713120000_add_replacement_policy` adds the singleton `ReplacementPolicy` row. Administrators can change `detectionDays` (when a shipped LOT becomes a proactive-replacement notification candidate) and `minimumDeliveryShelfDays` (the minimum remaining expiry period allowed for replacement stock) from `/replacements`. Both values must be positive integers, and each change writes an `REPLACEMENT_POLICY_UPDATE` audit record.

The migration initializes the policy to 60 notification days and 180 minimum delivery shelf-life days. It was applied to both the isolated test database and the operational Supabase database on 2026-07-13; migration status reports all six migrations current.

## Order Image Migration

Migration `20260721170000_add_order_image` adds the optional one-to-one `OrderImage` table. It stores only JPEG, PNG, or WebP content up to 3 MiB and enforces filename length, MIME allowlisting, byte-size bounds, and equality between the declared size and PostgreSQL `octet_length(data)`. The unique `orderId` foreign key uses `ON DELETE CASCADE`; cancelling an order does not delete its row or image.

This is an additive migration and needs no existing-order backfill. Deploy it with `npm run prisma:migrate:deploy` before starting the matching application artifact, then run `npm run prisma:generate`. The application serves bytes only through the authenticated `/api/orders/[orderId]/image` route and does not write uploads to the ephemeral deployment filesystem. This migration has been committed but has not been applied to an operational database in this workspace session.

## Rollback and Recovery

Prisma migrations are forward-only. Do not edit a migration after it has been deployed.

- For an application-only defect, roll back the application release while retaining compatible schema changes.
- For a destructive schema defect, restore the verified database backup or create a corrective forward migration.
- Before dropping or transforming data, document the backup identifier and test the restore procedure.
- Never use `prisma db push` against production.

### Historical seed administrator recovery

Before the next release, any database that may have run the historical sample seed must check for the legacy administrator credential. Use the dedicated command with a new temporary `SEED_ADMIN_PASSWORD` of at least 12 characters and an exact `SEED_DATABASE_TARGET` confirmation:

```bash
npm run prisma:rotate-legacy-admin
```

This mode is intentionally allowed in a production-labelled environment, but it performs no sample-data writes. It changes data only when the current `admin` password hash matches the historical public seed fingerprint. In that case it atomically renames and deactivates the vulnerable user, replaces its password with an unusable random value, creates a new `admin` with `mustChangePassword=true`, and records an audit entry. Retiring the original user ID also makes its existing signed sessions fail the active-user check. If no exact match exists, the command reports that no change was needed.

## Creating a Fresh Environment

1. Create an empty PostgreSQL database.
2. Set `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET`.
3. Run `npm run prisma:migrate:deploy`.
4. Run `npm run prisma:generate`.
5. Set a unique temporary `SEED_ADMIN_PASSWORD`, confirm the exact target in `SEED_DATABASE_TARGET`, and explicitly set `ALLOW_SAMPLE_DATA=true`, then run `npm run prisma:seed` only when sample operational data is appropriate. The sample mode refuses to run in production environments and does not reset a non-legacy existing administrator password.
6. Start the application and change the seeded administrator password immediately.
