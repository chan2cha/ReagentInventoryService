# Remaining Work and Improvements

Last updated: 2026-07-13

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

Remaining tasks:

- Consider redirecting users back to the originally requested route after login.
- Add server-side session versioning so ordinary password changes and administrator resets revoke previously issued sessions.
- Add login throttling and constant-cost invalid-credential handling.

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
| `ORDER_MANAGER` | Register/cancel orders, manage/use reusable order sets, view stock and clients, export data |
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

## Completed: Reusable Order Sets

Current state:

- `/orders/templates` lets `ADMIN` and `ORDER_MANAGER` users manage globally shared order sets without client mappings.
- A set stores its name, optional description, activation state, ordered reagent rows, and positive integer default quantities.
- Create, edit, and reactivation reject inactive or missing reagents. If a reagent is deactivated later, the management screen warns about it and order registration blocks that set from application.
- Edit and activation actions submit an expected `version`; compare-and-swap updates reject stale forms instead of overwriting another user's change.
- Create, edit, activation, and deactivation write audit entries in the same serializable transaction as the set change.
- `/orders/new` shows active sets and applies one with a single click while preserving the editable manual order workflow.
- Applying a set keeps unrelated manual rows, overwrites matching rows with the set's default quantities, and appends only missing rows. Applying it repeatedly is idempotent.
- One set can be selected as the order's baseline. Its card and persistent summary show `선택됨` or `구성 수정됨` based only on the baseline items, while unrelated manual additions remain independent.
- Each draft row tracks manual/template provenance. Selection and switching preserve existing manual quantities, switching removes only the previous set's template-only rows, detaching keeps all rows, and explicit default restoration resets only baseline items.
- Each order row exposes its provenance as a baseline-set item, manual addition, or manual item also included by the selected set so the effect of switching remains visible to the operator.
- The picker searches names, descriptions, reagent codes, and reagent names; filters to the selected set; and renders six cards at a time with progressive expansion.
- The order-form query uses a lean projection that excludes management-only creator/updater relations.
- A template-query failure is isolated from client and reagent loading, so operators can continue entering an order manually.

If the active-set collection grows to hundreds of sets with very large item lists, replace the current immediate client search with cursor-paged summaries and lazy-load item details when a set is selected. The current search, six-card disclosure, and lean projection are intended for the expected operational range while keeping the interaction instant.

Implemented:

- Added `OrderTemplate` and `OrderTemplateItem` through `20260712150000_add_order_templates`.
- Added management, search, registration, editing, activation, and deactivation UI and Server Actions.
- Added domain and service validation, active-reagent checks, normalized unique names, version concurrency control, and audit writes.
- Added order-draft merge logic and unit/integration coverage.

## Completed: Stock Adjustment

Current state:

- `/lots` supports LOT-level stock adjustment.
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
- Updated `ReagentLot.currentQuantity`.
- Created `StockMovement` with type `ADJUST` or `DISPOSE`.
- Shows adjustment and disposal records in `/movements`.

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
- The dashboard calculates low-stock entries using `currentQuantity < minStock`.

## Completed: Confirmation and Error UX

Current state:

- High-impact operational and account actions require confirmation.
- Buttons are disabled with an in-progress label during submission.
- Successful writes show a distinct completion notice.
- Existing query-string error notices remain in use; replacing these with structured form state is a future enhancement.

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

- `/lots` and `/movements` provide `DATA_EXPORT` users a current-condition shortcut that exports all matches rather than the visible page; inventory status and movement type are preserved with each search term through paging and export.
- `/exports` supports separate inventory and movement downloads and a selected combined workbook.
- Inventory supports a search term and computed stock-status filter. Movement history supports a separate search term, inclusive KST `from`/`to` dates, and movement-type filtering.
- Workbooks contain an `내보내기정보` sheet and the requested `재고현황` and/or `입출고이력` sheets.
- Movement sheets keep the raw recorded quantity separate from the calculated inventory delta and identify shipment order/client and actor when available.
- Each requested data sheet is limited to 10,000 rows and the final XLSX to 4,000,000 bytes.
- Combined sheets and movement shipment references use one bounded `Repeatable Read` snapshot, and workbook generation runs after the transaction is released.
- Report-specific parameters, per-cell text length, and aggregate UTF-8 text volume are validated before workbook materialization.
- Export queries use lean projections, deterministic ordering, and no sample-data fallback.
- The download API checks authentication, required password change, and `DATA_EXPORT` before querying data.
- Successful individual and combined downloads are audited before the file is returned.

Future improvements, if operational volume requires them:

- Replace the current bounded in-memory workbook generation with streaming or queued exports while preserving authorization and audit-before-release guarantees.
- Add scheduled reports only after retention, delivery, and recipient authorization policies are defined.

## Priority 9: Deployment and Environment

Current state:

- A full Prisma baseline migration exists for fresh databases.
- Forward migrations enforce P0 inventory invariants and add reusable order-set storage.
- `prisma:migrate:deploy` and `prisma:migrate:status` package commands are available.
- Previous one-off schema scripts have been removed.
- Migration, backup, recovery, and fresh-environment procedures are documented in `docs/11_database_migrations.md`.
- Schema validation, client generation, tests, and production build pass.
- The isolated test database passed the P0 preflight and all migrations through `20260712150000_add_order_templates`.
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

- 144 unit and policy tests run without external services, including encoded Action redirect headers, Next framework-error preservation, reusable order-set validation/services/actions, active-reagent policy, single-set row provenance and transitions, lean form projection, real-data sidebar shipment count/failure fallback, inventory-screen search/status pagination and status precedence, movement-screen search/type predicate reuse, export filters/date boundaries, movement delta rules, workbook formatting, download authorization, repeatable-read invocation, report-specific parameter rejection, structured audit details, row/text/file limits, and audit-before-release behavior.
- All 12 PostgreSQL integration tests pass against the isolated `TEST_DATABASE_URL`, including concurrent shipment, reversal, order-cancellation, stock-adjustment, reusable order-set lifecycle/version/audit, concurrent order-number scenarios, and filtered export/reference resolution.
- The integration suite blocks execution when the test and operational DB targets match.
- A built-server E2E verifies that an authenticated write Action commits, returns `303`, emits an ASCII-safe redirect header, and preserves the decoded Korean success message.
- A built production server against the isolated database verifies unauthenticated `401` behavior and authenticated combined XLSX sheet contents, stock delta, required audit creation, and complete fixture cleanup.

Recommended tests:

- Inbound stock validation.
- Order cancellation restrictions.
- Browser-level order-set management, repeated application, edited-quantity submission, and success-redirect flow.
- Authentication and authorization checks for every exported Server Action.
- P0 migration preflight and CHECK/partial-unique enforcement against a disposable PostgreSQL database.
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

1. Deploy or restart the verified application artifact in the actual hosting environment and run the browser-level order-set workflow smoke test.
2. Check for and, if necessary, retire the historical seed administrator before release.
3. Continue with audit completeness, strict shared validation, login throttling, and session revocation work.
