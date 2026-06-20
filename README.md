# CST CRM

Multi-user customer-success CRM built from `CST_CRM_MASTER_ROADMAP.md`.

## Stack

- `frontend/`: Next.js web application, including the SaaS UI, light/dark themes, and motion.
- `backend/`: Node.js API, authorization, validation, computed fields, and scheduled jobs.
- MongoDB: operational data and permanent invoice ledger.
- Root workspace: one-command local development, builds, tests, and MongoDB lifecycle.

The roadmap describes a relational model. The requested MongoDB implementation must preserve those relationships with referenced document IDs, unique indexes, validation, and transactions. Financial and dashboard calculations belong to the backend; clients must never submit computed values.

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop with Docker Compose

## Setup

1. Copy `.env.example` to `.env` and replace all placeholder secrets.
2. Install all workspace dependencies:

   ```powershell
   npm.cmd install
   ```

3. Start MongoDB:

   ```powershell
   npm.cmd run mongo:up
   ```

4. Copy the applicable environment values into `backend/.env` if the backend package provides its own example file.
5. Start frontend and backend together:

   ```powershell
   npm.cmd run dev
   ```

The default local URLs are `http://localhost:3000` for the frontend and `http://localhost:5000` for the backend.

## Commands

| Command | Purpose |
|---|---|
| `npm.cmd run dev` | Run both applications |
| `npm.cmd run dev:frontend` | Run Next.js only |
| `npm.cmd run dev:backend` | Run the API only |
| `npm.cmd run build` | Build both workspaces |
| `npm.cmd run lint` | Lint available workspaces |
| `npm.cmd test` | Test available workspaces |
| `npm.cmd run mongo:up` | Start local MongoDB |
| `npm.cmd run mongo:logs` | Follow MongoDB logs |
| `npm.cmd run mongo:down` | Stop local services |

## Architecture

```text
Browser
  -> Next.js frontend
      -> Node.js API
          -> MongoDB
          -> scheduler jobs
              -> invoice ledger
              -> report schedules
              -> lifecycle graduation
              -> alerts
```

Core collections follow the roadmap: `users`, `clients`, `services`, `clientServices`, `invoices`, `contacts`, `complaints`, `reports`, `upsells`, `onboardingChecklists`, `auditLogs`, and `schedulerRuns`.

Required database guarantees:

- Unique invoice index on `{ clientId, billingMonth }`.
- Unique report index on `{ clientId, category, label, periodMonth }`.
- Immutable historical invoice amounts during normal operations.
- Transactions for multi-document financial or lifecycle changes.
- Idempotent scheduler runs with execution records.
- Backend-owned MRR, timing, months-active, dashboard, and performance-score calculations.

## Delivery order

1. Phase 0: lock unresolved billing, date, timezone, currency, and migration rules.
2. Phase 1: authentication, clients, services, MRR, invoices, revenue, and dashboard v1.
3. Phase 2: onboarding, Kanban, contacts, reports, complaints, upsells, and dashboard v2.
4. Phase 3: alerts, exports, audit history, monitoring, backups, and performance hardening.

The Excel workbook remains required before migration and financial rule sign-off. Do not treat placeholder assumptions as approved production rules.
