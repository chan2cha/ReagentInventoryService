# Database Migration Operations

Last updated: 2026-07-10

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

After confirming that the existing database matches `prisma/schema.prisma`, register the baseline once without executing its table creation SQL:

```bash
npx prisma migrate resolve --applied 20260710000000_baseline
npm run prisma:migrate:status
```

Do not run `migrate resolve --applied` on a new empty database. A new database must run `npm run prisma:migrate:deploy`, which creates the full schema.

## Deployment Sequence

1. Create or verify a database backup.
2. Configure runtime `DATABASE_URL` with the transaction pooler and `DIRECT_URL` with the session pooler.
3. Run `npm run prisma:migrate:status`.
4. Run `npm run prisma:migrate:deploy`.
5. Run `npm run prisma:generate` during the application build.
6. Run `npm run prisma:seed` only for a new approved environment. Never seed production automatically.
7. Verify login, dashboard reads, and one non-destructive query.

## Rollback and Recovery

Prisma migrations are forward-only. Do not edit a migration after it has been deployed.

- For an application-only defect, roll back the application release while retaining compatible schema changes.
- For a destructive schema defect, restore the verified database backup or create a corrective forward migration.
- Before dropping or transforming data, document the backup identifier and test the restore procedure.
- Never use `prisma db push` against production.

## Creating a Fresh Environment

1. Create an empty PostgreSQL database.
2. Set `DATABASE_URL`, `DIRECT_URL`, and `AUTH_SECRET`.
3. Run `npm run prisma:migrate:deploy`.
4. Run `npm run prisma:generate`.
5. Run `npm run prisma:seed` only when sample operational data is appropriate.
6. Start the application and change the seeded administrator password immediately.
