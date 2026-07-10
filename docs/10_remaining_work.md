# Remaining Work and Improvements

Last updated: 2026-07-10

## Priority 1: Authentication and Access Control

### Implement Login

Current state:

- `/login` exists.
- Password verification uses PBKDF2 hashes stored in the existing `User` table.
- Login uses internal `loginId`, not email.
- Sessions are stored in signed httpOnly cookies.
- The app shell redirects unauthenticated users to `/login`.
- The sidebar shows the current user and logout action.
- Write actions enforce role checks.
- `/users` allows admins to register users and activate/deactivate accounts.
- Newly registered users must change their temporary password.
- `/account/password` allows users to change their own password.
- Admins can reset a user's temporary password; existing passwords are not exposed.

Remaining tasks:

- Consider redirecting users back to the originally requested route after login.
- Add production password rotation guidance.

### Add Role-Based Access

Current role enum:

- `ADMIN`
- `ORDER_MANAGER`
- `SHIPMENT_MANAGER`
- `VIEWER`

Suggested permissions:

| Role | Permissions |
|---|---|
| `ADMIN` | All features |
| `ORDER_MANAGER` | Register/cancel orders, view stock and clients |
| `SHIPMENT_MANAGER` | Process/cancel shipments, receive stock, view stock |
| `VIEWER` | Read-only access |

Remaining tasks:

- Add tests for forbidden write actions.

Completed UI policy:

- All authenticated roles can read operational data.
- Write controls and write-only navigation are capability-based.
- Direct access to restricted pages redirects to `/access-denied`.
- Server actions continue to enforce their own role checks.
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

- `/lots` supports LOT-level stock adjustment.
- `ADMIN` and `SHIPMENT_MANAGER` users can adjust stock.
- Signed quantities such as `+5` and `-2` are accepted.
- A reason is required.
- Negative resulting stock is blocked.
- `StockMovement` records are created with `ADJUST` or `DISPOSE`.

Implemented:

- Added stock adjustment action from `/lots`.
- Required reason input.
- Prevented quantity from going below zero.
- Updated `ReagentLot.currentQuantity`.
- Created `StockMovement` with type `ADJUST` or `DISPOSE`.
- Shows adjustment and disposal records in `/movements`.

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
- Administrators can review the latest audit records at `/audit`.
- Password, session integrity, and role-decision tests are implemented.

## Priority 9: Deployment and Environment

Current state:

- A full Prisma baseline migration exists for fresh databases.
- `prisma:migrate:deploy` and `prisma:migrate:status` package commands are available.
- Previous one-off schema scripts have been removed.
- Migration, backup, recovery, and fresh-environment procedures are documented in `docs/11_database_migrations.md`.
- Schema validation, client generation, tests, and production build pass.
- The existing Supabase schema is registered with `20260710000000_baseline` and is up to date.

Remaining tasks:

- Update `.env.example` with Supabase session pooler guidance.
- Add deployment guide for Vercel or chosen host.
- Ensure `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, and `AUTH_URL` are configured.

## Completed: Database Failure Handling

Current state:

- Production never substitutes sample data after a database query failure.
- Development sample data requires explicit `ALLOW_SAMPLE_DATA=true` opt-in.
- Query failures include a server-side screen scope in logs.
- Users receive a branded connection error screen with a retry action.
- Administrators see a database-connected indicator after authenticated data access succeeds.
- Empty database results remain correctly labelled as current information.

## Priority 10: Tests

Current tests:

- 23 unit and policy tests run without external services.
- 5 PostgreSQL integration tests run against an isolated `TEST_DATABASE_URL`.
- The integration suite blocks execution when the test and operational DB targets match.

Recommended tests:

- Order number generation.
- Inbound stock validation.
- Duplicate stock prevention.
- Shipment allocation across multiple stock entries.
- Insufficient stock failure.
- Shipment cancellation stock restore.
- Order cancellation restrictions.

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

1. Production deployment cleanup.
