# CST CRM API

Node.js, Express, TypeScript and MongoDB API implementing the CST CRM roadmap.

## Start

1. Copy `.env.example` to `.env` and set secrets.
2. Start MongoDB.
3. Run `npm install` from the repository root.
4. Run `npm run seed --workspace backend`.
5. Run `npm run dev --workspace backend`.

Health: `GET http://localhost:5000/api/health`

## API groups

- `/api/auth`: login and current user
- `/api/users`: Director team management; CST Managers can create and manage their own CST Handlers
- `/api/clients`, `/api/clients/:clientId/services`, `/api/services`
- `/api/invoices`: permanent ledger, sent/paid updates, revenue history
- `/api/onboarding`, `/api/contacts`, `/api/reports`, `/api/complaints`, `/api/upsells`
- `/api/dashboard`: Director-only computed KPIs and CST score
- `/api/system/jobs`, `/api/system/audit`: Director-only operational controls

Every route except login and health requires `Authorization: Bearer <token>`. Computed fields are absent from write schemas. Invoice snapshot fields are immutable and invoice deletion is intentionally unavailable.

`PATCH /api/clients/:id` with `{ "cstHandler": "..." }` (or the explicit `/assignment` alias) moves a client to an active CST Handler. Directors may assign any Handler; CST Managers may move clients only between Handlers on their own team. Every assignment is audited.

## Excel migration CLI

The importer is dry-run by default. It profiles the workbook, ignores configured computed/AUTO headers, validates and deduplicates clients, normalizes service amounts/onboarding/history, and writes three JSON artifacts without touching MongoDB.

1. Copy `migration.config.example.json`.
2. Replace every header with the exact workbook header.
3. List all 14 service columns.
4. Explicitly map every historical `BH` through `CE` header to its approved `YYYY-MM`. The CLI intentionally refuses to guess these months.
5. Seed users/services before committing.

```powershell
npm.cmd run migrate:excel -- --workbook "C:\path\CST SYSTEM ARHAM.xlsx" --config ".\migration.config.json" --output ".\migration-review"
```

Review:

- `migration-review.profile.json`: sheet names, dimensions, selected headers
- `migration-review.plan.json`: normalized payloads and reconciliation totals
- `migration-review.rejected.json`: invalid, duplicate, or unmatched rows

Only after the dry run reconciles and rejected rows are empty:

```powershell
npm.cmd run migrate:excel -- --workbook "C:\path\CST SYSTEM ARHAM.xlsx" --config ".\migration.config.json" --output ".\migration-review" --commit
```

`--commit` is idempotent and insert-only for client records, service links, historical invoices, and onboarding checklists. Existing CRM records are not overwritten.
