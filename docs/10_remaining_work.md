# Remaining Work and Improvements

Last updated: 2026-07-21

## Priority 1: Authentication and Access Control

### Implement Login

Current state:

- `/login` exists.
- Password verification uses PBKDF2 hashes stored in the existing `User` table.
- Login uses internal `loginId`, not email.
- Sessions are stored in signed httpOnly cookies.
- Production-labelled environments require a non-placeholder `AUTH_SECRET` of at least 32 characters and set secure session cookies.
- The app shell redirects unauthenticated users to `/login`.
- The sidebar shows the current user and logout action.
- Write actions enforce role checks.
- `/users` allows admins to register users and activate/deactivate accounts.
- Newly registered users must change their temporary password.
- `/account/password` allows users to change their own password.
- Admins can reset a user's temporary password; existing passwords are not exposed.
- Unknown, inactive, and wrong-password login attempts use the same PBKDF2 verification path and credential-failure response.
- Signed sessions carry a server-side `sessionVersion`; password changes, administrator resets, and account deactivation revoke older sessions. A successful self-service password change replaces the current browser's session with the new version.

Remaining tasks:

- Consider redirecting users back to the originally requested route after login.
- Login throttling is intentionally not planned because this is an internal-only service; revisit this decision if network exposure changes.

### Add Role-Based Access

Current role enum:

- `ADMIN`
- `ORDER_MANAGER`
- `SHIPMENT_MANAGER`
- `VIEWER`

Implemented permissions:

| Role | Permissions |
|---|---|
| `ADMIN` | All features |
| `ORDER_MANAGER` | Register/cancel orders, view stock and clients, export data |
| `SHIPMENT_MANAGER` | Process/cancel shipments, receive stock, view stock, export data |
| `VIEWER` | Read-only access without data export |

Remaining tasks:

- Add tests for forbidden write actions.

Completed UI policy:

- All authenticated roles can read operational data.
- Write controls and write-only navigation are capability-based.
- Direct access to restricted pages redirects to `/access-denied`.
- Server actions continue to enforce their own role checks.
- `DATA_EXPORT` allows `ADMIN`, `ORDER_MANAGER`, and `SHIPMENT_MANAGER`; it excludes `VIEWER` at navigation, page, screen-control, and API levels.
- Capability mapping is covered by automated tests.

## Completed: Multi-Item Orders

Current state:

- `/orders/new` supports multiple reagent and quantity rows.
- Duplicate reagent selection is blocked in the UI.
- Duplicate reagent rows are merged on the server if submitted.

Implemented:

- Converted the order form to a client component for add/remove item rows.
- Allows multiple reagent and quantity pairs.
- Validates all rows on submit.
- Prevents duplicate reagent rows in the UI and merges duplicates on the server.
- Creates multiple `OrderItem` records in one transaction.
- Existing order and shipment summaries already display multiple items.

## Completed: Stock Adjustment

Current state:

- `/lots` supports LOT-and-warehouse-level stock adjustment.
- `ADMIN` and `SHIPMENT_MANAGER` users can adjust stock.
- A row-specific dialog separates add, subtract, and disposal operations and accepts positive quantities only.
- The dialog previews resulting stock, warns below minimum stock, and blocks negative results.
- A reason is required.
- Negative resulting stock is blocked.
- Stock changes use conditional atomic increments/decrements inside retryable serializable transactions.
- `StockMovement` records are created with `ADJUST` or `DISPOSE`.

Implemented:

- Added stock adjustment action from `/lots`.
- Required reason input.
- Prevented quantity from going below zero.
- Updated the selected `WarehouseStock.quantity` balance.
- Created `StockMovement` with type `ADJUST` or `DISPOSE`.
- Shows adjustment and disposal records in `/movements`.

## Completed: Warehouse Inventory and Partial Transfer

Current state:

- Five fixed warehouses are supported: finished goods, samples, returns, nonconforming goods, and disposal.
- `WarehouseStock` keyed by `(reagentLotId, warehouse)` is the single source of mutable inventory quantity; `ReagentLot.currentQuantity` has been removed.
- `/lots` shows and filters the warehouse column and allows `ADMIN` and `SHIPMENT_MANAGER` to transfer part of a balance with a required reason.
- Source decrement, destination upsert, one `TRANSFER` movement, and one `STOCK_TRANSFER` audit log are atomic in a retryable Serializable transaction.
- General and replacement shipment FEFO allocation reads only `FINISHED_GOODS`; cancellation restores that warehouse.
- Moving stock to `DISPOSAL` preserves total physical quantity. `DISPOSE` remains the distinct operation that removes actually discarded stock.
- Inventory and movement exports carry warehouse data and accept individual or combined warehouse filters.

Deployment note:

- Apply `20260721160000_add_transfer_movement_type` before `20260721161000_add_warehouse_inventory` in the same write-stopped maintenance window as the matching application release.
- Take and verify a backup first. The cutover drops `ReagentLot.currentQuantity`, so the old application must not resume after migration.

## Completed: P0 Inventory and Authentication Guards

Current state:

- Session creation and validation live in a `server-only` module; only logout remains an exported authentication Server Action.
- Accounts marked `mustChangePassword` cannot invoke role-protected mutations before changing the password.
- Shipment allocation excludes expired and future-received LOTs while allowing stock through its expiration day.
- Shipment, reversal, order cancellation, and stock adjustment use conditional state/quantity claims with bounded serializable retries.
- A forward migration adds database CHECK constraints, duplicate order-item protection, one `SHIPPED` shipment per order, and missing foreign-key indexes.
- The sample seed requires exact database-target confirmation plus explicit non-production opt-in and no longer contains or resets a known administrator password.
- A narrowly scoped recovery mode retires and replaces only an administrator whose password hash matches the historical public seed fingerprint.
- Repeat sample seeding updates tagged seed movements instead of deleting the administrator's movement history.

## Completed: Reagent and Client Management Writes

Current state:

- Administrators can register and edit reagents and clients.
- Administrators can deactivate or reactivate both data types.
- Reagent code and client name duplicate checks are applied case-insensitively.
- Reagent minimum stock can be maintained from `/allergens`.
- Non-administrator users retain read-only access.

## Completed: Date Handling

Current state:

- Operating dates use Korean Standard Time through one shared date utility.
- Dashboard daily metrics query the exact UTC range for the current Korean calendar day.
- Order numbers use the current Korean date prefix and orders retain their actual creation timestamp.
- Expiration dates are handled as date-only values without timezone date shifting.
- Inbound registration defaults to the current Korean date.
- Korean midnight boundaries and date-only comparisons have automated tests.

## Completed: Safety Stock

Current state:

- Prisma `Allergen` stores `minStock Int @default(0)`.
- Seed data defines a minimum stock value for each sample reagent.
- `/lots` marks entries below the reagent threshold as `재고부족`.
- `/allergens` reads the minimum stock value from the database.
- The dashboard calculates low-stock entries from finished-goods `WarehouseStock.quantity < minStock`.

## Completed: Confirmation and Error UX

Current state:

- High-impact operational and account actions require confirmation.
- Buttons are disabled with an in-progress label during submission.
- Successful writes show a distinct completion notice.
- Success and error notices use a short-lived httpOnly flash cookie and clean-path redirects rather than URL query parameters. The rendered client notice immediately calls the same-origin cleanup endpoint, while the cookie also expires after two minutes as a fallback.

## Completed: Operational Audit

Current state:

- Stock movements and critical business operations are recorded separately.
- Order and shipment cancellation require a reason.
- Audit records identify the processing user and timestamp.
- Successful inventory, movement, and combined workbook generation records `INVENTORY_EXPORT`, `MOVEMENT_EXPORT`, or `COMBINED_EXPORT` with entity type `DATA_EXPORT`, counts, and filters.
- A workbook is not released when its required audit write fails.
- Administrators can review the latest audit records at `/audit`.
- Password, session integrity, and role-decision tests are implemented.

## Completed: Excel Data Export

Current state:

- `/lots`, `/movements`, and `/orders` provide `DATA_EXPORT` users a current-condition shortcut that exports all matches rather than the visible page; order search and inclusive KST order dates are preserved through paging and export.
- `/exports` supports separate inventory and movement downloads and a selected combined workbook.
- Inventory supports a search term, warehouse and computed stock-status filter. Movement history supports a separate search term, source-or-destination warehouse, inclusive KST `from`/`to` dates, and movement-type filtering.
- Workbooks contain an `내보내기정보` sheet and the requested `재고현황`, `입출고이력`, or 품목별 `주문내역` sheet.
- Movement sheets keep the raw recorded quantity separate from the calculated inventory delta and identify shipment order/client and actor when available.
- Each requested data sheet is limited to 10,000 rows and the final XLSX to 4,000,000 bytes.
- Combined sheets and movement shipment references use one bounded `Repeatable Read` snapshot, and workbook generation runs after the transaction is released.
- Report-specific parameters, per-cell text length, and aggregate UTF-8 text volume are validated before workbook materialization.
- Export queries use lean projections, deterministic ordering, and no sample-data fallback.
- The download API checks authentication, required password change, and `DATA_EXPORT` before querying data.
- Successful individual and combined downloads, including `ORDER_EXPORT`, are audited before the file is returned.

Future improvements, if operational volume requires them:

- Replace the current bounded in-memory workbook generation with streaming or queued exports while preserving authorization and audit-before-release guarantees.
- Add scheduled reports only after retention, delivery, and recipient authorization policies are defined.

## Priority 9: Deployment and Environment

Current state:

- A full Prisma baseline migration exists for fresh databases.
- Forward migrations enforce P0 inventory invariants and retain the applied migration history; `20260721150000_remove_order_templates` removes the retired tables without deleting the earlier add migration. Two later migrations add `TRANSFER` and cut inventory over to `WarehouseStock`.
- `prisma:migrate:deploy` and `prisma:migrate:status` package commands are available.
- Previous one-off schema scripts have been removed.
- Migration, backup, recovery, and fresh-environment procedures are documented in `docs/11_database_migrations.md`.
- The 2026-07-21 removal change passed schema validation, typecheck, lint, unit tests, and the isolated integration test cases. Regenerate the Prisma client and rerun the production build after stopping the active development server.
- On 2026-07-12 the isolated test database passed the P0 preflight and applied all migrations then present through `20260712150000_add_order_templates`; that historical migration remains immutable.
- Apply and verify `20260721150000_remove_order_templates`, `20260721160000_add_transfer_movement_type`, and `20260721161000_add_warehouse_inventory` in each environment through the documented forward migration workflow and maintenance window.
- On 2026-07-12 the operational Supabase database also passed all nine P0 preflight checks, was backed up, applied both pending forward migrations, and passed post-deployment catalog and authenticated read-only screen checks.

Remaining tasks:

- Update `.env.example` with Supabase session pooler guidance.
- Add deployment guide for Vercel or chosen host.
- Ensure `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, and the explicitly verified seed target (when seeding) are configured.

## Completed: Database Failure Handling

Current state:

- Production never substitutes sample data after a database query failure.
- Development sample data requires explicit `ALLOW_SAMPLE_DATA=true` opt-in.
- Query failures include a server-side screen scope in logs.
- Users receive a generic retry screen that does not mislabel every application failure as a database outage or expose internal error details.
- Administrators see a database-connected indicator after authenticated data access succeeds.
- Empty database results remain correctly labelled as current information.

## Priority 10: Tests

Current tests:

- Unit and policy tests cover session revocation, constant-cost invalid-credential handling, Action redirect headers, framework-error preservation, manual multi-item ordering, sidebar failure fallback, warehouse inventory and movement filtering, partial-transfer validation/retry, export boundaries, workbook formatting, authorization, and audit-before-release behavior.
- PostgreSQL integration coverage includes concurrent shipment, reversal, order cancellation, warehouse stock adjustment and partial transfer, finished-goods-only shipment, proactive replacement, concurrent order-number scenarios, and filtered export/reference resolution.
- The integration suite blocks execution when the test and operational DB targets match.
- A built-server E2E verifies that an authenticated write Action commits, returns `303`, emits an ASCII-safe redirect header, and preserves the decoded Korean success message.
- A built production server against the isolated database verifies unauthenticated `401` behavior and authenticated combined XLSX sheet contents, stock delta, required audit creation, and complete fixture cleanup.

Recommended tests:

- Inbound stock validation.
- Order cancellation restrictions.
- Browser-level manual multi-item order entry, validation, and success-redirect flow.
- Authentication and authorization checks for every exported Server Action.
- P0 migration preflight and CHECK/partial-unique enforcement against a disposable PostgreSQL database.
- Warehouse cutover backfill, `TRANSFER` shape CHECK, and old-column removal against a disposable copy of production-shaped data.
- Seed refusal and idempotency tests around non-production sample environments.

## Priority 11: Documentation Maintenance

Current state:

- Korean documents and source strings are stored as UTF-8.
- `00` through `07` describe the original plan and business rules.
- `08`, `09`, and `10` describe the current implementation baseline and remaining work.

Tasks:

- Keep all Markdown, TypeScript, and JavaScript files encoded as UTF-8.
- Read files with UTF-8 explicitly in PowerShell when checking Korean text, for example `Get-Content -Encoding UTF8`.
- Keep `09_current_implementation_status.md` updated whenever workflows, screens, validation status, or known issues change.
- Keep `10_remaining_work.md` updated whenever priorities are completed or reprioritized.
- As implementation diverges from the original plan, update `00` through `07` rather than duplicating conflicting requirements.

## Suggested Next Implementation Order

1. Back up and verify each target, stop writes, apply the order-set removal and both warehouse migrations, deploy the matching artifact, and run inventory transfer, finished-goods shipment, movement and export smoke tests.
2. Check for and, if necessary, retire the historical seed administrator before release.
3. Continue with audit completeness, strict shared validation, and authorization regression coverage.
