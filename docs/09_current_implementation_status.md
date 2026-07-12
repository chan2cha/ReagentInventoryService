# Current Implementation Status

Last updated: 2026-07-13

## Summary

The application is now a Next.js App Router service backed by Prisma and Supabase PostgreSQL.

The main operational workflow is implemented end to end:

1. Register inbound reagent stock.
2. View stock by reagent, manufacture number, expiration date, and quantity.
3. Register customer orders.
4. Cancel orders before shipment.
5. Ship orders using earliest-expiring stock first.
6. Cancel shipments and restore stock.
7. Track inbound, outbound, adjustment, disposal, and reversal history.
8. View operational status on the dashboard.
9. Authenticate users with a signed httpOnly cookie session.
10. Enforce role checks on write operations.
11. Manage internal users from an administrator-only screen.
12. Require newly registered users to change their temporary password.
13. Track reagent-specific minimum stock and flag low-stock lots.
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
25. Manage globally reusable order sets and apply them idempotently to editable multi-item order drafts.
26. Use one reusable set as an order's editable baseline, preserve manual rows through set changes, and keep large set collections usable through in-form search, selected-only filtering, and progressive disclosure.
27. Export filtered stock and movement data as individual or selected combined XLSX sheets with access control, size limits, and audit records.

List pagination uses 20 rows per page and URL query parameters. Audit, movements, orders, lots, clients, allergens, and users use `page`; shipments preserve independent `ordersPage` and `historyPage` values for the two lists on the same screen.

List search uses URL query parameters and remains active while paging. Shipments provide independent search terms for pending orders and shipment history.

Authorized users can export all rows matching the current `/lots` or `/movements` search directly from those screens, independently of the visible 20-row page. `/exports` provides separate filters and individual or selected combined workbooks.

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

- `DATABASE_URL`
- `DIRECT_URL`
- `ALLOW_SAMPLE_DATA` (development-only opt-in; keep `false` in production)

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
| `/lots` | Implemented | DB-backed stock list by reagent/manufacture number/expiration. |
| `/receiving` | Implemented | Creates inbound stock and inbound movement history. |
| `/orders` | Implemented | Lists orders, supports order cancellation. |
| `/orders/new` | Implemented | Creates multi-item orders manually or from one searchable baseline set, with exact/modified state, safe set switching, and six-at-a-time disclosure. |
| `/orders/templates` | Implemented | `ADMIN`/`ORDER_MANAGER` management of global order sets, items, and activation state. |
| `/shipments` | Implemented | Ships orders, shows recent shipments, supports shipment cancellation. |
| `/clients` | Implemented | DB-backed client registration, editing, and activation management. |
| `/allergens` | Implemented | DB-backed reagent registration, editing, minimum stock, and activation management. |
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
| `ORDER_MANAGER` | All operational data | Order registration/cancellation and reusable order-set management | Allowed |
| `SHIPMENT_MANAGER` | All operational data | Receiving, shipment processing/cancellation, and stock adjustment | Allowed |
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
- Validates reagent, manufacture number, quantity, inbound date, and expiration date.
- Prevents duplicate stock by `allergenId + lotNo + expirationDate`.
- Creates `ReagentLot`.
- Creates `StockMovement` with type `IN`.
- Revalidates stock and movement pages.

### Order Registration

Files:

- `src/app/orders/new/page.tsx`
- `src/app/orders/new/actions.ts`
- `src/app/orders/new/order-form-data.ts`

Behavior:

- Loads active clients and reagents.
- Loads active reusable order sets independently so a template-query failure does not disable manual order entry.
- Creates order number in `ORD-YYYYMMDD-###` format.
- Creates `Order` with status `RECEIVED`.
- Creates one or more `OrderItem` records in the same transaction.
- Allows multiple reagent and quantity rows in the order form.
- Prevents duplicate reagent selection in the UI and merges duplicate rows on the server if submitted.
- Applies a selected order set as an editable draft: unrelated manual rows remain, matching rows receive the set's default quantity, and missing rows are appended.
- Applying the same set repeatedly is idempotent and never increments quantities or duplicates items.
- Revalidates dashboard, order, and shipment pages.

### Reusable Order Sets

Files:

- `prisma/migrations/20260712150000_add_order_templates/migration.sql`
- `src/app/orders/templates/page.tsx`
- `src/app/orders/templates/actions.ts`
- `src/services/order-template-service.ts`
- `src/domain/order-template.ts`
- `src/domain/order-draft.ts`

Behavior:

- Stores globally reusable sets in `OrderTemplate` and ordered default items in `OrderTemplateItem`; there is intentionally no client relationship.
- Allows `ADMIN` and `ORDER_MANAGER` users to create, edit, activate, deactivate, search, and apply sets.
- Requires a unique normalized name, one to 100 distinct reagents, and positive integer default quantities.
- Requires every reagent to be active when a set is created, edited, or reactivated.
- Keeps a set visible in management after one of its reagents is later deactivated, but warns about the reagent and blocks application until the set is corrected.
- Uses `version` compare-and-swap updates for edits and activation changes so stale forms cannot overwrite a newer change.
- Replaces the item collection and writes `ORDER_TEMPLATE_CREATE`, `ORDER_TEMPLATE_UPDATE`, `ORDER_TEMPLATE_ACTIVATE`, or `ORDER_TEMPLATE_DEACTIVATE` audit records in the same serializable transaction.
- Shows only active sets on order registration and preserves fully manual multi-item ordering when set loading is unavailable.

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
- Allocates eligible stock from earliest expiration first.
- Fails the whole transaction if stock is insufficient.
- Claims the order state and decrements each LOT with conditional updates so concurrent requests cannot create duplicate active shipments or negative stock.
- Runs at `Serializable` isolation and retries Prisma `P2034` or compare-and-set conflicts up to a fixed limit.
- Creates `Shipment`.
- Creates `ShipmentItem`.
- Decrements `ReagentLot.currentQuantity`.
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
- Restores `ReagentLot.currentQuantity` from `ShipmentItem`.
- Creates `StockMovement` with type `REVERSE`.
- Restores `Order.status` to `READY_TO_SHIP`.

### Stock Movement History

Files:

- `src/app/movements/page.tsx`
- `src/app/movements/movement-data.ts`

Behavior:

- Shows stock movement records with reagent, manufacture number, quantity, reason, and date.
- Maps internal movement types to user-facing Korean labels, including `REVERSE` as `출고취소/복구`.
- Filters the screen by a shared search term and movement type, preserving both through pagination and the current-condition Excel shortcut.

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
- Adds current-condition exports to `/lots` and `/movements`; inventory preserves `q` and computed inventory status, while movements preserve both `q` and movement type, and all matching rows are exported rather than only the current page.
- Provides individual inventory and movement downloads plus a selected combined workbook from `/exports`.
- Filters inventory by search term and `NORMAL`, `LOW_STOCK`, `OUT_OF_STOCK`, `EXPIRING`, or `EXPIRED` status using the same expiration/quantity/minimum-stock precedence as the screen. Filters movement exports by search term, inclusive Korean-calendar `from`/`to` dates, and movement type.
- Creates `내보내기정보` first, followed by the requested `재고현황` and/or `입출고이력` sheets. Sheets use real date and numeric cells, frozen headers, filters, and fixed column formats.
- Separates the stored movement quantity from the effective stock delta: outbound is negative, inbound and reversal are positive, and adjustment/disposal retain their recorded sign.
- Resolves shipment references to order and client where available and includes the movement actor.
- Reads at most 10,001 rows to reject any requested sheet above 10,000 rows, and rejects generated files above 4,000,000 bytes.
- Reads each request inside a bounded `Repeatable Read` transaction so combined sheets and movement shipment references share one database snapshot; workbook construction and audit writing happen after that read transaction is released.
- Rejects report-mismatched parameters and validates per-cell plus aggregate UTF-8 text budgets before ExcelJS materializes the workbook.
- Uses lean projections and stable unique tie-breakers. Export DB failures are returned as errors and never replaced with sample rows.
- Writes `INVENTORY_EXPORT`, `MOVEMENT_EXPORT`, or `COMBINED_EXPORT` with actor, counts, and compact filter details before releasing a successful file. A failed audit write prevents download.

### Stock Adjustment and Disposal

Files:

- `src/app/lots/page.tsx`
- `src/app/lots/actions.ts`
- `src/domain/stock-adjustment.ts`
- `src/services/stock-service.ts`

Behavior:

- Allows `ADMIN` and `SHIPMENT_MANAGER` users to adjust LOT stock from `/lots`.
- Opens a row-specific adjustment dialog with explicit add, subtract, and disposal operations.
- Accepts positive quantities only and previews the resulting stock before submission.
- Warns when the result falls below minimum stock and blocks changes that would make stock negative.
- Requires a reason.
- Uses conditional atomic increments/decrements and blocks changes that would make current quantity negative, including concurrent changes.
- Creates `StockMovement` with type `ADJUST` or `DISPOSE`.
- Revalidates dashboard, stock, and movement pages.

### Minimum Stock Monitoring

Files:

- `prisma/schema.prisma`
- `src/app/dashboard-data.ts`
- `src/app/lots/lot-data.ts`
- `src/app/allergens/allergen-data.ts`

Behavior:

- Stores a reagent-specific minimum stock value in `Allergen.minStock`.
- Seeds minimum stock values for the sample reagents.
- Marks stock entries below the configured threshold as `재고부족`.
- Calculates the dashboard low-stock count using each reagent's configured threshold.

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
- Lets administrators configure reagent minimum stock from the reagent screen.
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
- Runs native required-field validation before requesting confirmation.

### Authentication Tests and Audit Log

Behavior:

- Tests PBKDF2 password verification, malformed hashes, session signing, expiration, and tamper rejection.
- Tests explicit role allow/deny decisions used by server-side authorization.
- Requires a reason when cancelling an order or shipment.
- Records order cancellation, shipment processing/cancellation, reusable order-set writes, user registration, activation changes, administrator password resets, and successful data exports.
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
- `prisma/migrations/20260712150000_add_order_templates/migration.sql`
- Operations guide: `docs/11_database_migrations.md`
- The existing Supabase schema was registered with `20260710000000_baseline`. On 2026-07-12 the operational database passed the P0 preflight and both forward migrations through `20260712150000_add_order_templates` were applied successfully.
- The P0 invariant migration adds quantity/date CHECK constraints, duplicate-order-item protection, one active shipment per order, and foreign-key traversal indexes. Run its documented preflight before deployment.
- The order-set migration adds `OrderTemplate` and `OrderTemplateItem`, normalized-name and per-template uniqueness, positive quantity/version checks, actor foreign keys, and no client mapping.

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

The following checks passed after the latest implementation updates:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

Date handling is centralized in `src/lib/date.ts`. Korean midnight boundaries, date-only expiration comparisons, and UTC query ranges are covered by automated tests.

The external-service-free suite currently contains 144 unit and policy tests. In addition to the prior authentication, transaction, validation, redirect, and reusable-order-set regressions, it covers the real-data sidebar shipment count and failure fallback, inventory-screen search/status pagination, inventory status precedence and export matching, movement-screen search/type predicate reuse, export filter validation and Korean date boundaries, movement labels and stock-delta direction, lean export projections, row/text/file limits, shipment-reference resolution, repeatable-read invocation, report-specific parameter rejection, structured audit details, workbook sheet/cell formatting, download authorization, and audit-before-release behavior. Integration tests use `TEST_DATABASE_URL`, reject both runtime and direct operational DB targets even when a different database username or pooler port is supplied, and run separately with `npm run test:integration`. The 12-test integration suite calls the production services and covers the existing inventory/shipment contention cases plus reusable order-set create/search/concurrent-update/stale-version rejection/deactivation/audit behavior, stale-order rejection after reagent deactivation, concurrent order-number allocation, and filtered inventory/movement export with shipment-reference resolution.

The 144-test unit suite, typecheck, lint, Prisma validation, production build, and all 12 isolated PostgreSQL integration tests passed on 2026-07-13. The isolated `TEST_DATABASE_URL` is current through `20260712150000_add_order_templates`. A built Next server E2E confirmed both the unauthenticated no-store Korean JSON `401` path and an authenticated combined export with `내보내기정보`, `재고현황`, and `입출고이력` sheets, typed inventory delta, and one required `COMBINED_EXPORT` audit record. Its temporary user, reagent, lot, movement, and audit fixtures were removed and a zero-fixture cleanup check passed. The earlier authenticated Server Action E2E confirmed a `303` response, committed data, an ASCII-safe redirect header, and the correctly decoded Korean success message; its fixture was also removed immediately afterward.

The operational database separately passed all nine P0 preflight checks, was backed up in PostgreSQL custom format, and successfully applied both pending forward migrations. Post-deployment status reported all three migrations current; 14 CHECK constraints and five key unique/partial indexes were verified. After correcting the saved pooler assignments, authenticated read-only production-server smoke requests using the normal `:6543` runtime connection returned HTTP 200 for `/orders/templates` and `/orders/new` without an error page. The application artifact still needs to be deployed or restarted if it runs in a separate hosting environment.

## Known Issues

1. Write flows rely on correct Supabase pooler configuration; transaction pooler can produce Prisma prepared statement errors.
2. Korean text in the source and documents is stored as UTF-8. Use UTF-8 when reading files in PowerShell, for example `Get-Content -Encoding UTF8`, to avoid console mojibake.
