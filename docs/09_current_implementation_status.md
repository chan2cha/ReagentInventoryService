# Current Implementation Status

Last updated: 2026-08-05

## Summary

The application is now a Next.js App Router service backed by Prisma and Supabase PostgreSQL.

The main operational workflow is implemented end to end:

1. Register inbound reagent stock.
2. View stock by reagent, manufacture number, expiration date, warehouse, and quantity.
3. Register customer orders.
4. Cancel orders before shipment.
5. Ship orders using earliest-expiring stock first.
6. Cancel shipments and restore stock.
7. Track inbound, outbound, adjustment, disposal, reversal, and partial warehouse-transfer history.
8. View operational status on the dashboard.
9. Authenticate users with a signed httpOnly cookie session.
   Sessions are version-bound and are revoked after password resets or account deactivation.
10. Enforce role checks on write operations.
11. Manage internal users from an administrator-only screen.
12. Require newly registered users to change their temporary password.
13. Classify warehouse balances as normal, out of stock, expiring, or expired from quantity and expiration date.
14. Manage reagent and client master data from administrator screens.
15. Confirm high-impact operations, prevent duplicate submission, and show completion feedback.
16. Record critical administrator, cancellation, and data-export activity in an administrator-only audit log.
17. Apply the Shinyoung Lofarma login-screen brand system across authenticated screens.
18. Use Korean Standard Time for operating dates, daily metrics, order numbers, and date display.
19. Prevent sample data from masking database failures and provide a retryable service error screen.
20. Track the full database schema through a Prisma baseline migration and deployment commands.
21. Keep operational data readable across roles while exposing write controls only to assigned managers.
22. Run isolated PostgreSQL integration tests without touching operational data.
23. Page high-volume operational and administration lists with database-level count/skip/take queries.
24. Search operational and administration lists with database-level, case-insensitive partial matching where supported.
25. Export filtered stock and movement data as individual or selected combined XLSX sheets with access control, size limits, and audit records.
26. Detect expiry-driven proactive replacement candidates from original shipment LOTs, confirm client remaining quantity, ship eligible replacement LOTs, and record return disposition and audit history.
27. Keep authoritative balances in `WarehouseStock` for finished goods, samples, returns, nonconforming goods, and disposal, and transfer partial quantities atomically between them.
28. Register orders through searchable client/reagent controls and optionally store one validated, authenticated 3 MiB JPEG/PNG/WebP attachment in the same transaction.
29. Install the production site as a standalone PWA with logo-based desktop icons and a non-data-caching offline notice.

List pagination uses 20 rows per page and URL query parameters. Audit, movements, orders, lots, clients, allergens, and users use `page`; shipments preserve independent `ordersPage` and `historyPage` values for the two lists on the same screen.

List search uses URL query parameters and remains active while paging. Shipments provide independent search terms for pending orders and shipment history.

Authorized users can export all rows matching the current `/lots` or `/movements` search, warehouse and status/type directly from those screens, independently of the visible 20-row page. `/exports` provides separate filters and individual or selected combined workbooks.

User-facing labels have been revised to use operator-friendly terms:

| Technical/Internal Term | User-Facing Term |
|---|---|
| Dashboard | 업무 현황 |
| Allergen | 시약 |
| LOT | 입고분 or 제조번호-based stock |
| FEFO | 유통기한 빠른 순 |
| Prisma DB | 최신 정보 |
| Sample data | 예시 정보 |
| REVERSE | 출고취소/복구 |
| DB connection | 연결 상태 |

## Tech Stack

| Area | Current Choice |
|---|---|
| Framework | Next.js App Router |
| Language | TypeScript |
| Database | Supabase PostgreSQL |
| ORM | Prisma |
| UI | React Server Components, Server Actions, plain CSS |
| Auth | Self-managed login ID, PBKDF2 password hashes, signed httpOnly cookie |
| Excel | ExcelJS-generated XLSX workbooks |
| Test | Vitest |

## Environment

The application uses Prisma with:

- `DATABASE_URL` for the runtime PostgreSQL connection
- `DIRECT_URL` for Prisma migrations and seed operations
- `AUTH_SECRET` for signed sessions
- `AUTH_URL` as the configured service URL
- `APP_ENV` for environment-sensitive security and seed guards
- `ALLOW_SAMPLE_DATA` (development-only opt-in; keep `false` in production)
- `TEST_DATABASE_URL` only for the isolated PostgreSQL integration suite

Copy `.env.example` to `.env` for local development and replace every placeholder. The Compose/NAS and database-copy workflows use their separate `.env.nas.example` and `.env.db.example` templates.

Important Supabase note:

- The transaction pooler on `:6543` can cause Prisma prepared statement errors during writes and schema operations.
- The session pooler on `:5432` worked reliably for schema push, seed, and read checks in this workspace.
- Runtime `DATABASE_URL` uses the transaction pooler on `:6543` with `pgbouncer=true`, `connection_limit=3`, and `pool_timeout=30` unless the URL supplies explicit values.
- Prisma migration and seed operations use `DIRECT_URL` with the session pooler on `:5432`.
- The local `.env` inspected during deployment initially had these two ports assigned in reverse. The operational migration used the verified `:5432` URL through a one-command override, after which the saved values were corrected and both ordinary migration status and the `:6543` runtime path were revalidated.
- Database query failures are logged with a screen-specific scope and propagated to the application error boundary.
- Sample fallback is disabled by default and can never be enabled when `NODE_ENV=production`.
- Export queries never substitute sample data, including in development.
- Empty database tables are shown as valid empty states, not labelled as sample data.

## Implemented Screens

Authenticated screens use the official company logo in a white sidebar, Shinyoung Lofarma blue accents, restrained square controls, and responsive navigation consistent with the login screen.

| Route | Status | Notes |
|---|---|---|
| `/login` | Implemented | Self-managed login using the `User` table. |
| `/` | Implemented | DB-backed operational dashboard. |
| `/lots` | Implemented | DB-backed stock list by reagent/manufacture number/expiration, with status/warehouse filters and expiration, receiving-date, quantity, or manufacture-number sorting. |
| `/receiving` | Implemented | Creates inbound stock and inbound movement history. |
| `/orders` | Implemented | Lists orders and protected attachment links, supports order cancellation. |
| `/orders/new` | Implemented | Creates multi-item orders with searchable client/reagent selection and one optional validated image. |
| `/shipments` | Implemented | Ships orders, shows recent shipments, supports shipment cancellation. |
| `/replacements` | Implemented | `ADMIN`/`SHIPMENT_MANAGER` proactive replacement candidate review, exclusion, confirmation, FEFO replacement shipment, and return disposition; `ADMIN` can manage notification and replacement shelf-life thresholds. |
| `/clients` | Implemented | DB-backed client registration, editing, and activation management. |
| `/allergens` | Implemented | DB-backed reagent registration, editing, and activation management. |
| `/movements` | Implemented | DB-backed stock movement history. |
| `/exports` | Implemented | `ADMIN`/`ORDER_MANAGER`/`SHIPMENT_MANAGER` individual and selected combined XLSX exports. |
| `/users` | Implemented | Administrator-only user list, registration, activation, and deactivation. |
| `/account/password` | Implemented | Current-user password change screen. |
| `/audit` | Implemented | Administrator-only audit history for critical operations. |
| `/access-denied` | Implemented | Branded guidance for direct access to unauthorized write/admin pages. |

## Role-Based UI Access

| Role | Read Access | Write Access | Data Export |
|---|---|---|---|
| `ADMIN` | All operational screens | All operations and administration | Allowed |
| `ORDER_MANAGER` | All operational data | Order registration and cancellation | Allowed |
| `SHIPMENT_MANAGER` | All operational data | Receiving, shipment processing/cancellation, warehouse stock adjustment and transfer | Allowed |
| `VIEWER` | All operational data | None | Denied |

Write-only navigation and table action columns are hidden when the current role lacks the capability. `DATA_EXPORT` similarly hides `/exports` navigation and stock/movement download controls from `VIEWER`. Direct page and `/api/exports` access retain independent authentication, mandatory-password-change, and capability checks.

The sidebar shipment badge runs one indexed count for orders in `RECEIVED` or `READY_TO_SHIP`, sharing the same predicate as the dashboard and shipment queue. It is queried only after authentication and the mandatory-password redirect check. A count failure is logged and suppresses the badge instead of showing sample data or failing every authenticated page; values above 99 are displayed as `99+` while the exact count remains available to assistive technology and as a tooltip.

## Implemented Workflows

### Inbound Stock Registration

Files:

- `src/app/receiving/page.tsx`
- `src/app/receiving/actions.ts`
- `src/app/receiving/receiving-data.ts`

Behavior:

- Loads active reagent list.
- Validates reagent, manufacture number, quantity, warehouse, inbound date, and expiration date.
- Prevents duplicate stock by `allergenId + lotNo + expirationDate`.
- Creates `ReagentLot` and the selected `WarehouseStock` balance; `ReagentLot` no longer duplicates a mutable current quantity.
- Creates `StockMovement` with type `IN` and the selected warehouse.
- Revalidates stock and movement pages.

### Order Registration

Files:

- `src/app/orders/new/page.tsx`
- `src/app/orders/new/actions.ts`
- `src/app/orders/new/order-form-data.ts`

Behavior:

- Loads active clients and reagents.
- Creates order number in `ORD-YYYYMMDD-###` format.
- Creates `Order` with status `RECEIVED`.
- Creates one or more `OrderItem` records in the same transaction.
- Allows multiple reagent and quantity rows in the order form.
- Prevents duplicate reagent selection in the UI and merges duplicate rows on the server if submitted.
- Revalidates dashboard, order, and shipment pages.

### Order Cancellation

Files:

- `src/app/orders/actions.ts`
- `src/app/orders/page.tsx`

Behavior:

- Allows cancellation only before shipment.
- Blocks cancellation when the order is already shipped or already cancelled.
- Updates `Order.status` to `CANCELLED`.
- Removes the order from the shipment waiting list.

### Shipment Processing

Files:

- `src/app/shipments/page.tsx`
- `src/app/shipments/actions.ts`
- `src/app/shipments/shipment-data.ts`
- `src/services/shipment-service.ts`
- `src/lib/transaction.ts`

Behavior:

- Loads orders in `RECEIVED` or `READY_TO_SHIP`.
- Excludes expired and future-received LOTs using the current Korean calendar date; a LOT remains valid through its expiration date.
- Loads eligible stock from active warehouses, distinguishes the same LOT by warehouse, and allows the operator to select the manufacture number and source warehouse.
- Allocates eligible stock from earliest expiration first across active warehouses and persists the selected source warehouse on each `ShipmentItem`.
- Partially ships available stock when inventory is insufficient and creates a linked shortage reorder for the remaining quantity.
- Claims the order state and conditionally decrements each selected `(reagentLotId, warehouse)` balance so concurrent requests cannot create duplicate active shipments or negative stock.
- Runs at `Serializable` isolation and retries Prisma `P2034` or compare-and-set conflicts up to a fixed limit.
- Creates `Shipment`.
- Stores a shipment memo of up to 500 characters and includes it in the shipment audit description; it is optional for normal fulfillment and required for partial fulfillment.
- Creates `ShipmentItem`.
- Decrements `WarehouseStock.quantity` for the selected `(reagentLotId, warehouse)` balance.
- Creates `StockMovement` with type `OUT`.
- Updates `Order.status` to `SHIPPED`.

### Shipment Cancellation and Stock Restore

Files:

- `src/app/shipments/actions.ts`
- `src/app/shipments/page.tsx`
- `src/services/shipment-service.ts`

Behavior:

- Shows recent shipment history.
- Allows cancellation of active shipments.
- Conditionally claims `SHIPPED` to `CANCELLED`, so concurrent cancellation requests cannot restore stock twice.
- Restores the exact source warehouse's `WarehouseStock.quantity` from `ShipmentItem`.
- Creates `StockMovement` with type `REVERSE`.
- Restores `Order.status` to `READY_TO_SHIP`.
- Cancels a linked shortage reorder while it is still received or ready to ship.
- Blocks cancellation of the original shipment after its linked shortage reorder has already shipped; the shortage shipment must be cancelled first.

### Stock Movement History

Files:

- `src/app/movements/page.tsx`
- `src/app/movements/movement-data.ts`

Behavior:

- Shows stock movement records with reagent, manufacture number, quantity, reason, date, source/affected warehouse, and transfer destination.
- Maps internal movement types to user-facing Korean labels, including `REVERSE` as `출고취소/복구` and `TRANSFER` as `창고이동`.
- Filters the screen by a shared search term, movement type and source-or-destination warehouse, preserving them through pagination and the current-condition Excel shortcut.

### Warehouse Inventory and Partial Transfer

Files:

- `prisma/schema.prisma`
- `src/domain/warehouse.ts`
- `src/app/lots/inventory-management-dialog.tsx`
- `src/app/lots/actions.ts`
- `src/services/warehouse-transfer-service.ts`

Behavior:

- Uses active records from the warehouse master; legacy defaults remain `FINISHED_GOODS`, `SAMPLE`, `RETURNED`, `NONCONFORMING`, and `DISPOSAL`.
- Uses `WarehouseStock` keyed by `(reagentLotId, warehouse)` as the only mutable inventory quantity.
- Lists one inventory row per LOT and warehouse and supports warehouse filtering and export.
- Opens one `재고 관리` dialog per row and switches between stock adjustment and warehouse transfer without duplicating table actions.
- Allows `ADMIN` and `SHIPMENT_MANAGER` to move a positive partial quantity between different warehouses with a required reason.
- Conditionally decrements the source and upserts the destination within a retryable Serializable transaction.
- Records one positive `TRANSFER` movement with both warehouses and one `STOCK_TRANSFER` audit record in the same transaction.
- Keeps total physical quantity unchanged during transfer. Moving into the disposal warehouse is quarantine/location movement; a later `DISPOSE` operation removes actual stock.

### Excel Data Export

Files:

- `src/app/exports/page.tsx`
- `src/app/exports/export-center.tsx`
- `src/app/exports/export-download-button.tsx`
- `src/app/api/exports/route.ts`
- `src/lib/excel-export.ts`
- `src/domain/export-filters.ts`
- `src/domain/lot-status.ts`
- `src/domain/stock-movement-presentation.ts`
- `src/services/export-data-service.ts`

Behavior:

- Grants `DATA_EXPORT` to `ADMIN`, `ORDER_MANAGER`, and `SHIPMENT_MANAGER`; `VIEWER` cannot see the controls and receives `403` from direct API calls.
- Adds current-condition exports to `/lots`, `/movements`, and `/orders`; orders preserve search plus inclusive KST `from`/`to` dates, and all matching rows are exported rather than only the current page.
- Provides individual inventory and movement downloads plus a selected combined workbook from `/exports`.
- Filters inventory by search term and `NORMAL`, `LOW_STOCK`, `OUT_OF_STOCK`, `EXPIRING`, or `EXPIRED` status using the same expiration/quantity/minimum-stock precedence as the screen. Filters movement exports by search term, inclusive Korean-calendar `from`/`to` dates, and movement type.
- Creates `내보내기정보` first, followed by the requested `재고현황`, `입출고이력`, or per-item `주문내역` sheet. Sheets use real date and numeric cells, frozen headers, filters, and fixed column formats.
- Separates the stored movement quantity from the effective stock delta: outbound is negative, inbound and reversal are positive, and adjustment/disposal retain their recorded sign.
- Resolves shipment references to order and client where available and includes the movement actor.
- Reads at most 10,001 rows to reject any requested sheet above 10,000 rows, and rejects generated files above 4,000,000 bytes.
- Reads each request inside a bounded `Repeatable Read` transaction so combined sheets and movement shipment references share one database snapshot; workbook construction and audit writing happen after that read transaction is released.
- Rejects report-mismatched parameters and validates per-cell plus aggregate UTF-8 text budgets before ExcelJS materializes the workbook.
- Uses lean projections and stable unique tie-breakers. Export DB failures are returned as errors and never replaced with sample rows.
- Writes `INVENTORY_EXPORT`, `MOVEMENT_EXPORT`, `ORDER_EXPORT`, or `COMBINED_EXPORT` with actor, counts, and compact filter details before releasing a successful file. A failed audit write prevents download.

### Stock Adjustment and Disposal

Files:

- `src/app/lots/page.tsx`
- `src/app/lots/actions.ts`
- `src/domain/stock-adjustment.ts`
- `src/services/stock-service.ts`

Behavior:

- Allows `ADMIN` and `SHIPMENT_MANAGER` users to adjust a selected LOT and warehouse balance from `/lots`.
- Opens a row-specific adjustment dialog with explicit add, subtract, and disposal operations.
- Accepts positive quantities only and previews the resulting stock before submission.
- Blocks changes that would make the selected warehouse balance negative.
- Requires a reason.
- Uses conditional atomic increments/decrements on `WarehouseStock.quantity` and blocks changes that would make that warehouse balance negative, including concurrent changes.
- Creates `StockMovement` with type `ADJUST` or `DISPOSE`.
- Revalidates dashboard, stock, and movement pages.

### Stock Status Monitoring

Files:

- `prisma/schema.prisma`
- `src/app/dashboard-data.ts`
- `src/app/lots/lot-data.ts`
- `src/app/allergens/allergen-data.ts`

Behavior:

- `Allergen.minStock` was removed by `20260723160000_remove_allergen_min_stock` and is not part of the current schema or reagent UI.
- Classifies each warehouse balance as `정상`, `품절`, `유통기한 임박`, or `유통기한 만료` from `WarehouseStock.quantity` and the LOT expiration date.
- Uses a 30-day inclusive threshold for the expiring status and treats zero quantity as out of stock.
- Calculates the dashboard expiring count and priority list from finished-goods balances.

### Reagent and Client Management

Files:

- `src/app/allergens/actions.ts`
- `src/app/allergens/page.tsx`
- `src/app/clients/actions.ts`
- `src/app/clients/page.tsx`

Behavior:

- Allows administrators to register and edit reagents and clients.
- Allows administrators to activate or deactivate master data without deleting history.
- Normalizes reagent codes to uppercase and rejects duplicate codes case-insensitively.
- Rejects duplicate client names case-insensitively.
- Keeps reagent master data limited to code, name, category, and active state.
- Keeps both screens read-only for non-administrator users.
- Revalidates dependent receiving, ordering, stock, and dashboard screens after changes.

### Operation Confirmation and Feedback

Files:

- `src/app/submit-button.tsx`
- `src/app/orders/page.tsx`
- `src/app/shipments/page.tsx`
- `src/app/lots/page.tsx`
- `src/app/users/page.tsx`
- `src/app/allergens/page.tsx`
- `src/app/clients/page.tsx`

Behavior:

- Requests confirmation before order cancellation, shipment processing/cancellation, stock adjustment, password reset, and activation changes.
- Describes the operational effect in each confirmation message.
- Disables submitted buttons and shows a processing label while the server action runs.
- Shows distinct success and error notices after processing.
- Stores notices in a short-lived httpOnly flash cookie, redirects to a clean path, and clears the cookie after the notice is rendered; messages are not placed in URL query parameters or browser history.
- Runs native required-field validation before requesting confirmation.

### Authentication Tests and Audit Log

Behavior:

- Tests PBKDF2 password verification, malformed hashes, session signing, expiration, and tamper rejection.
- Runs unknown, inactive, and wrong-password login attempts through the same PBKDF2 verification path and returns the same credential-failure response.
- Tests explicit role allow/deny decisions used by server-side authorization.
- Requires a reason when cancelling an order or shipment.
- Records order cancellation, shipment processing/cancellation, user registration, activation changes, administrator password resets, and successful data exports.
- Uses `INVENTORY_EXPORT`, `MOVEMENT_EXPORT`, and `COMBINED_EXPORT` for export audit records with entity type `DATA_EXPORT`.
- Stores business-write audit records in the same transaction as the related update; export audit records are written after workbook validation and before file release.
- Shows the latest 200 records to administrators at `/audit`, including time, action, detail, and actor.

### User Management

Files:

- `src/app/users/page.tsx`
- `src/app/users/actions.ts`
- `src/app/users/user-data.ts`

Behavior:

- Allows only `ADMIN` users to access the page.
- Lists login ID, name, email, role, registration date, and active status.
- Creates internal users with `loginId`, name, optional email, temporary password, and role.
- Hashes temporary passwords before saving.
- Marks newly created users as `mustChangePassword`.
- Prevents duplicate login IDs and duplicate emails.
- Supports activation and deactivation.
- Blocks deactivation of the currently logged-in admin account.
- Allows administrators to reset a user's temporary password without exposing existing passwords.
- Marks users as `mustChangePassword` after administrator password reset.

### Password Change

Files:

- `src/app/account/password/page.tsx`
- `src/app/account/password/actions.ts`

Behavior:

- Allows authenticated users to change their own password.
- Requires current password verification.
- Requires the new password and confirmation to match.
- Requires a minimum password length of 8 characters.
- Clears `mustChangePassword` after a successful change.
- Redirects users with `mustChangePassword` to `/account/password` before they can use other app screens.
- Rejects role-protected Server Actions while `mustChangePassword` is set; only authenticated password change and logout remain available.
- Keeps session creation, validation, and cookie mutation in a `server-only` authentication module; logout is exposed through a dedicated Server Action.
- Rejects missing, short, or placeholder `AUTH_SECRET` values whenever `NODE_ENV`, `APP_ENV`, or `VERCEL_ENV` identifies a production environment, and marks the session cookie secure under the same policy.
- Existing passwords are never shown because only password hashes are stored.

## Database and Seed

Schema:

- `prisma/schema.prisma`

Seed:

- `prisma/seed.js`

Migrations:

- `prisma/migrations/20260710000000_baseline/migration.sql`
- `prisma/migrations/20260712000000_enforce_inventory_invariants/migration.sql`
- `prisma/migrations/20260712150000_add_order_templates/migration.sql` (immutable historical migration)
- `prisma/migrations/20260713100000_add_user_session_version/migration.sql`
- `prisma/migrations/20260713110000_add_proactive_replacements/migration.sql`
- `prisma/migrations/20260713120000_add_replacement_policy/migration.sql`
- `prisma/migrations/20260721150000_remove_order_templates/migration.sql`
- `prisma/migrations/20260721160000_add_transfer_movement_type/migration.sql`
- `prisma/migrations/20260721161000_add_warehouse_inventory/migration.sql`
- `prisma/migrations/20260721170000_add_order_image/migration.sql`
- `prisma/migrations/20260721180000_update_client_delivery_fields/migration.sql`
- `prisma/migrations/20260722100000_add_partial_shipment_reorders/migration.sql`
- `prisma/migrations/20260722113000_add_warehouse_master/migration.sql`
- `prisma/migrations/20260722120000_add_warehouse_active/migration.sql`
- `prisma/migrations/20260723133000_add_manual_defect_replacements/migration.sql`
- `prisma/migrations/20260723160000_remove_allergen_min_stock/migration.sql`
- `prisma/migrations/20260729140000_add_shipment_item_warehouse/migration.sql`
- Operations guide: `docs/11_database_migrations.md`
- The existing Supabase schema was registered with `20260710000000_baseline`. On 2026-07-12 the operational database passed the P0 preflight and applied both forward migrations through `20260712150000_add_order_templates`; that applied migration remains in source history and must not be deleted or rewritten. On 2026-07-13 it also applied the session-version and proactive-replacement migrations.
- The P0 invariant migration adds quantity/date CHECK constraints, duplicate-order-item protection, one active shipment per order, and foreign-key traversal indexes. Run its documented preflight before deployment.
- `20260721150000_remove_order_templates` is the forward removal: it drops the retired child and parent tables without rewriting migration history. Existing generic `AuditLog` rows remain as historical records because they do not use foreign keys to those tables.
- `20260721160000_add_transfer_movement_type` commits the PostgreSQL enum value separately; `20260721161000_add_warehouse_inventory` backfills every legacy quantity into `FINISHED_GOODS`, verifies the copy, removes `ReagentLot.currentQuantity`, and applies warehouse and transfer CHECK constraints.
- Later migrations replace the warehouse enum with an administrator-maintained `Warehouse` master, add warehouse activation, partial-shipment reorders, manual defect replacements, remove the retired `Allergen.minStock`, and persist the source warehouse on every shipment item.

Seed currently creates:

- 10 reagents
- 11 stock entries
- 5 clients
- 1 admin user with a randomly salted PBKDF2 password hash and mandatory first-login password change
- 5 orders
- 9 order items
- 6 stock movements

Inject a unique temporary `SEED_ADMIN_PASSWORD` of at least 12 characters through the approved secret-management process. Verify the exact `host:port/database?schema=...` value derived from `DIRECT_URL`, set it as `SEED_DATABASE_TARGET`, then run the seed:

```bash
SEED_DATABASE_TARGET='verified-host:5432/postgres?schema=public' \
ALLOW_SAMPLE_DATA=true \
npm run prisma:seed
```

The seed requires both the exact database-target confirmation and explicit sample-data opt-in, and is still rejected when `NODE_ENV`, `APP_ENV`, or `VERCEL_ENV` identifies a production environment. On a repeat run, a non-legacy existing administrator's password and `mustChangePassword` state are preserved. Seeded movement rows are matched and updated through `SAMPLE_SEED` references; the seed no longer deletes every movement created by the administrator.

Databases that may have run the historical public administrator seed require a one-time check before release. The recovery command below is the only seed mode allowed in a production-labelled environment. It changes data only when the current `admin` password hash exactly matches the historical fingerprint: the vulnerable user is renamed, assigned an unusable random password, marked inactive, and replaced with a new `admin` that must change its temporary password. This also invalidates sessions tied to the retired user ID.

```bash
SEED_DATABASE_TARGET='verified-host:5432/postgres?schema=public' \
npm run prisma:rotate-legacy-admin
```

For Supabase session pooler use during seed in this workspace, commands were run with `DATABASE_URL` temporarily changed from `:6543` to `:5432`.

## Validation

The following source-only checks passed on 2026-08-05:

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
npm test
```

`npm run prisma:migrate:status` and `npm run test:integration` remain required per target environment because they connect to and, for integration tests, modify an explicitly isolated PostgreSQL database.

Date handling is centralized in `src/lib/date.ts`. Korean midnight boundaries, date-only expiration comparisons, and UTC query ranges are covered by automated tests.

The external-service-free suite covers authentication, transaction, validation, redirect, manual multi-item order submission, session revocation, sidebar failure fallback, inventory and movement filtering, export limits, workbook formatting, and audit-before-release behavior. Integration tests use `TEST_DATABASE_URL`, reject both runtime and direct operational DB targets, and exercise inventory and shipment contention, stale-order rejection after reagent deactivation, concurrent order-number allocation, proactive replacement, and filtered export/reference resolution.

The 2026-07-13 validation record shows that the then-current unit suite, typecheck, lint, Prisma validation, production build, isolated PostgreSQL integration suite, authenticated Server Action E2E, and combined-export E2E passed. The warehouse feature's focused domain and transfer-service tests pass, but the complete commands above must be rerun after applying both warehouse migrations to the isolated database rather than relying on old totals.

The operational database separately passed all nine P0 preflight checks, was backed up in PostgreSQL custom format, and successfully applied its initial forward migrations. Apply `20260721150000_remove_order_templates` and both warehouse migrations through the documented maintenance-window backup, status, deploy, application-cutover, and reconciliation procedure before treating an environment as current.

## Known Issues

1. Write flows rely on correct Supabase pooler configuration; transaction pooler can produce Prisma prepared statement errors.
2. Korean text in the source and documents is stored as UTF-8. Use UTF-8 when reading files in PowerShell, for example `Get-Content -Encoding UTF8`, to avoid console mojibake.
3. The warehouse cutover removes `ReagentLot.currentQuantity`; an old application artifact is incompatible after migration. Stop writes and deploy the matching artifact in the same maintenance window.
