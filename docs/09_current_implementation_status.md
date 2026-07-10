# Current Implementation Status

Last updated: 2026-07-10

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
16. Record administrator and cancellation activity in an administrator-only audit log.
17. Apply the Shinyoung Lofarma login-screen brand system across authenticated screens.
18. Use Korean Standard Time for operating dates, daily metrics, order numbers, and date display.
19. Prevent sample data from masking database failures and provide a retryable service error screen.
20. Track the full database schema through a Prisma baseline migration and deployment commands.
21. Keep operational data readable across roles while exposing write controls only to assigned managers.
22. Run isolated PostgreSQL integration tests without touching operational data.

User-facing labels have been revised to use operator-friendly terms:

| Technical/Internal Term | User-Facing Term |
|---|---|
| Dashboard | 업무 현황 |
| Allergen | 시약 |
| LOT | 입고분 or 제조번호-based stock |
| FEFO | 유통기한 빠른 순 |
| Prisma DB | 최신 정보 |
| Sample data | 예시 정보 |
| REVERSE | 되돌림 기록 |
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
| Test | Vitest |

## Environment

The application uses Prisma with:

- `DATABASE_URL`
- `DIRECT_URL`
- `ALLOW_SAMPLE_DATA` (development-only opt-in; keep `false` in production)

Important Supabase note:

- The transaction pooler on `:6543` can cause Prisma prepared statement errors during writes and schema operations.
- The session pooler on `:5432` worked reliably for schema push, seed, and read checks in this workspace.
- Recommended for this project: use the Supabase session pooler for both `DATABASE_URL` and `DIRECT_URL` unless deployment requirements dictate otherwise.
- Database query failures are logged with a screen-specific scope and propagated to the application error boundary.
- Sample fallback is disabled by default and can never be enabled when `NODE_ENV=production`.
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
| `/orders/new` | Implemented | Creates a single-item order. |
| `/shipments` | Implemented | Ships orders, shows recent shipments, supports shipment cancellation. |
| `/clients` | Implemented | DB-backed client registration, editing, and activation management. |
| `/allergens` | Implemented | DB-backed reagent registration, editing, minimum stock, and activation management. |
| `/movements` | Implemented | DB-backed stock movement history. |
| `/users` | Implemented | Administrator-only user list, registration, activation, and deactivation. |
| `/account/password` | Implemented | Current-user password change screen. |
| `/audit` | Implemented | Administrator-only audit history for critical operations. |
| `/access-denied` | Implemented | Branded guidance for direct access to unauthorized write/admin pages. |

## Role-Based UI Access

| Role | Read Access | Write Access |
|---|---|---|
| `ADMIN` | All operational screens | All operations and administration |
| `ORDER_MANAGER` | All operational data | Order registration and cancellation |
| `SHIPMENT_MANAGER` | All operational data | Receiving, shipment processing/cancellation, and stock adjustment |
| `VIEWER` | All operational data | None |

Write-only navigation and table action columns are hidden when the current role lacks the capability. Direct access to order registration, receiving, user management, and audit pages is checked at page level. Server actions retain independent role checks.

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

Behavior:

- Loads orders in `RECEIVED` or `READY_TO_SHIP`.
- Allocates stock from earliest expiration first.
- Fails the whole transaction if stock is insufficient.
- Creates `Shipment`.
- Creates `ShipmentItem`.
- Decrements `ReagentLot.currentQuantity`.
- Creates `StockMovement` with type `OUT`.
- Updates `Order.status` to `SHIPPED`.

### Shipment Cancellation and Stock Restore

Files:

- `src/app/shipments/actions.ts`
- `src/app/shipments/page.tsx`

Behavior:

- Shows recent shipment history.
- Allows cancellation of active shipments.
- Updates `Shipment.status` to `CANCELLED`.
- Restores `ReagentLot.currentQuantity` from `ShipmentItem`.
- Creates `StockMovement` with type `REVERSE`.
- Restores `Order.status` to `READY_TO_SHIP`.

### Stock Movement History

Files:

- `src/app/movements/page.tsx`
- `src/app/movements/movement-data.ts`

Behavior:

- Shows stock movement records with reagent, manufacture number, quantity, reason, and date.
- Maps internal movement types to user-facing Korean labels.

### Stock Adjustment and Disposal

Files:

- `src/app/lots/page.tsx`
- `src/app/lots/actions.ts`
- `src/domain/stock-adjustment.ts`

Behavior:

- Allows `ADMIN` and `SHIPMENT_MANAGER` users to adjust LOT stock from `/lots`.
- Accepts signed adjustment quantities such as `+5` or `-2`.
- Requires a reason.
- Blocks changes that would make current quantity negative.
- Updates `ReagentLot.currentQuantity`.
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
- Records order cancellation, shipment processing/cancellation, user registration, activation changes, and administrator password resets.
- Stores audit records in the same transaction as the related business update.
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
- Existing passwords are never shown because only password hashes are stored.

## Database and Seed

Schema:

- `prisma/schema.prisma`

Seed:

- `prisma/seed.js`

Migration baseline:

- `prisma/migrations/20260710000000_baseline/migration.sql`
- Operations guide: `docs/11_database_migrations.md`
- The existing Supabase schema is registered with `20260710000000_baseline` and reports as up to date.

Seed currently creates:

- 10 reagents
- 11 stock entries
- 5 clients
- 1 admin user with a PBKDF2 password hash
- 5 orders
- 9 order items
- 6 stock movements

Local seed login:

- ID: `admin`
- Password: `admin1234!`

Command:

```bash
npm run prisma:seed
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

Integration tests use `TEST_DATABASE_URL`, reject the operational DB target, and run separately with `npm run test:integration`. The current suite verifies duplicate LOT constraints, atomic rollback, FEFO allocation across LOTs, insufficient-stock rollback, duplicate shipment blocking, shipment cancellation stock restoration, order state restoration, and audit writes.

## Known Issues

1. Write flows rely on correct Supabase pooler configuration; transaction pooler can produce Prisma prepared statement errors.
2. Korean text in the source and documents is stored as UTF-8. Use UTF-8 when reading files in PowerShell, for example `Get-Content -Encoding UTF8`, to avoid console mojibake.
