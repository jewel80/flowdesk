# FlowDesk — Billing Approval Workflow

> **FGL Lead Full-Stack Take-Home — Option 1: ERP Workflow Module**

FlowDesk is a small, production-shaped ERP workflow module for an internal
**billing-approval** process. It removes manual coordination between **Sales**,
**Accounts** and **Management** by turning a billing request into a tracked,
auditable workflow that ends in an automatically generated invoice.

```
Sales creates a billing request → Accounts reviews (approve / reject)
   → on approval an Invoice is generated asynchronously
      → Accounts marks it paid → Management watches it all on a dashboard
```

Every state change is **role-guarded** and written to an **append-only audit
trail**, so at any moment you can answer *who did what, when, and why*.

---

## Table of contents

1. [Why this option](#why-this-option)
2. [Quick start (Docker)](#quick-start-docker)
3. [Demo accounts](#demo-accounts)
4. [Key user flows](#key-user-flows)
5. [Architecture](#architecture)
6. [Read/write database splitting](#readwrite-database-splitting)
7. [Tech stack & rationale](#tech-stack--rationale)
8. [Data model](#data-model)
9. [The workflow state machine](#the-workflow-state-machine)
10. [API reference](#api-reference)
11. [Project structure](#project-structure)
12. [Local development (without Docker)](#local-development-without-docker)
13. [Testing](#testing)
14. [Security & access control](#security--access-control)
15. [Assumptions](#assumptions)
16. [What I'd improve with more time](#what-id-improve-with-more-time)
17. [AI-assisted development note](#ai-assisted-development-note)

---

## Why this option

The rubric weights **backend/data-model (20%)**, **product/user flow (20%)** and
**reliability/security/testing (15%)** most heavily, and explicitly rewards a
*complete small module over a large unfinished one*. A billing-approval workflow
is the cleanest way to demonstrate the things that actually move those needles:

- a real, explicit **state machine** with guarded transitions;
- **role-based access control** (approvals are inherently an authorization
  problem);
- an **append-only audit trail** built atomically with each state change;
- a justified use of **async processing** (invoice generation off the request
  path via a queue) rather than a queue bolted on for show.

---

## Quick start (Docker)

The only prerequisite is Docker (with Compose v2). No paid services, no external
credentials.

```bash
git clone <your-public-repo-url>
cd flowdesk
docker compose up --build
```

Then open:

| Surface | URL |
| --- | --- |
| **Web app** | http://localhost:8080 |
| API base | http://localhost:3000/api/v1 |
| API health | http://localhost:3000/api/v1/health |

On startup the API container automatically **applies database migrations** and
**seeds demo data** (idempotent — safe to re-run). The first build takes a couple
of minutes; subsequent runs are cached.

To reset all data: `docker compose down -v` (removes the Postgres volume), then
bring it back up.

---

## Demo accounts

All accounts share the password **`password123`**. The login screen also lists
them with one-click fill.

| Role | Email | Can do |
| --- | --- | --- |
| **Sales** | `sales@flowdesk.dev` | Create / edit / submit / revise own requests |
| **Sales** | `sales2@flowdesk.dev` | (a second sales user, to show ownership scoping) |
| **Accounts** | `accounts@flowdesk.dev` | Approve / reject requests, mark invoices paid |
| **Manager** | `manager@flowdesk.dev` | Read-only org-wide dashboards & metrics |

---

## Key user flows

1. **Create & submit (Sales).** Sara logs in, creates a draft billing request,
   edits it freely while it is a `DRAFT`, then submits it for review.
2. **Review (Accounts).** Aaron sees all submitted requests, opens one and either
   **approves** it or **rejects** it with a mandatory reason.
3. **Automatic invoicing (System).** On approval a job is enqueued; a background
   worker generates the invoice, moves the request to `INVOICED` and logs a
   simulated notification — all without blocking the approval response.
4. **Revise & resubmit (Sales).** If rejected, Sara sees the reason, reopens the
   request to a draft, fixes it and submits again.
5. **Get paid (Accounts).** Aaron marks the issued invoice as paid.
6. **Oversee (Manager).** Maria sees organisation-wide metrics and the status
   breakdown; Sales users see only their own figures.

Every screen handles **loading, error and empty states** explicitly.

---

## Architecture

FlowDesk is a small monorepo with three runtime tiers plus a worker, wired
together by Docker Compose.

```
                         ┌──────────────────────────────────────────────┐
                         │                  Browser                      │
                         │     React + Vite SPA (TypeScript)             │
                         │   react-query · auth context · RBAC-aware UI  │
                         └───────────────────────┬──────────────────────┘
                                                 │  HTTP (same-origin /api/v1)
                         ┌───────────────────────▼──────────────────────┐
                         │            web container (nginx)              │
                         │   serves static build · proxies /api → api    │
                         └───────────────────────┬──────────────────────┘
                                                 │
                         ┌───────────────────────▼──────────────────────┐
                         │             api container (NestJS)            │
                         │                                              │
                         │   Controller  →  Service  →  Repository      │
                         │   (HTTP)         (domain)     (persistence)  │
                         │                                              │
                         │   Guards:  JwtAuthGuard → RolesGuard         │
                         │   Global:  ValidationPipe · ExceptionFilter  │
                         └─────┬─────────────────┬───────────────┬──────┘
                               │                 │               │
                  Prisma ORM   │        enqueue  │ BullMQ        │ Prisma
                               ▼                 ▼               ▼
                     ┌───────────────┐   ┌──────────────┐  (invoice worker
                     │  PostgreSQL   │   │    Redis     │   in the same
                     │  (state +     │   │  (job queue) │   api process)
                     │   audit log)  │   └──────┬───────┘
                     └───────▲───────┘          │ process job
                             │                  ▼
                             └──────── Invoice worker writes invoice +
                                       flips request to INVOICED (atomic)
```

**Layered request flow (synchronous path):**

```
HTTP request
  → ValidationPipe          (DTO validation, whitelist, transform)
  → JwtAuthGuard            (verify token, attach principal)
  → RolesGuard              (enforce @Roles)
  → Controller              (routing only, no logic)
  → Service                 (business rules, workflow, ownership, audit)
  → Repository              (Prisma data access; transactions)
  → PostgreSQL
  ← AllExceptionsFilter wraps any error in a consistent envelope
```

**Async path (on approval):** the service commits the `APPROVED` transition, then
enqueues a `generate-invoice` job. The BullMQ worker creates the invoice, flips
the request to `INVOICED` and writes the audit entry **inside one transaction**.
The job is **idempotent** (a retry finds the existing invoice and no-ops) and the
queue retries with exponential backoff on failure.

A fuller diagram and the design rationale live in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Read/write database splitting

To support high-traffic production workloads, the data layer separates **write**
and **read** connections:

- **All writes** (INSERT/UPDATE/DELETE) and **all transactions** go to the
  **primary** via `prisma.primary`.
- **All reads** (SELECT/find/count/aggregate/groupBy) go to a **read replica**
  via `prisma.reader`, which **round-robins** across any number of configured
  replicas.

This keeps heavy read traffic off the primary and lets reads scale horizontally
by adding replicas — the primary is reserved for the writes only it can serve.

```
                         ┌──────────────┐   writes / transactions
        prisma.primary ─►│   PRIMARY    │◄──────────────────────────
                         │  (postgres)  │
                         └──────┬───────┘
                                │  WAL streaming replication
                 ┌──────────────┼──────────────┐
                 ▼              ▼               ▼
          ┌───────────┐  ┌───────────┐  ┌───────────┐
          │ replica 1 │  │ replica 2 │  │    ...     │   ◄─ prisma.reader
          └───────────┘  └───────────┘  └───────────┘     (round-robin reads)
```

**Implementation.** [`PrismaService`](api/src/common/prisma/prisma.service.ts)
holds a primary client plus one client per replica (composition, not
`extends PrismaClient` — see the file's comment on the PrismaClient Proxy
pitfall). Repositories call `this.prisma.primary.*` for writes and
`this.prisma.reader.*` for reads; the read default on a repository method can be
overridden by passing a transaction client, so a read inside a write transaction
correctly hits the primary.

**Self-contained by default.** Replicas are configured via the
`DATABASE_REPLICA_URLS` env var (comma-separated). **When it is empty, `reader`
transparently falls back to the primary** — so the default
`docker compose up --build` runs against a single Postgres with zero extra setup.

**Consistency caveat.** Replicas are *eventually consistent* (replication lag). A
read needing to observe a just-committed write must use the primary or the same
transaction — e.g. the invoice worker performs its idempotency check and writes
inside one transaction on the primary.

### Run it with a real streaming replica (optional)

An override file spins up a genuine **primary + hot-standby replica** using
PostgreSQL streaming replication (official `postgres` image, no third-party
dependencies):

```bash
docker compose -f docker-compose.yml -f docker-compose.replica.yml up --build
```

You'll then see the API log `Connected to PostgreSQL (1 primary + 1 read
replica(s))`, and on the primary:

```bash
docker exec flowdesk-postgres-1 \
  psql -U flowdesk -d flowdesk -c "SELECT application_name, state, sync_state FROM pg_stat_replication;"
# flowdesk_replica | streaming | async
```

---

## Tech stack & rationale

| Concern | Choice | Why |
| --- | --- | --- |
| Backend | **NestJS (Node + TypeScript)** | First-class DI and module boundaries make the Controller→Service→Repository separation natural and testable. |
| ORM | **Prisma** | Type-safe queries, a readable single-file schema, and a first-class **migrations** workflow — great for reviewers to understand the data model at a glance. |
| Database | **PostgreSQL** | Relational integrity fits a workflow with foreign keys, enums and an audit table; transactions keep state + audit consistent. Supports streaming replication for the read/write split. |
| Queue / async | **BullMQ + Redis** | Moves invoice generation off the request path with retries and idempotency — a real reason to use a queue, not decoration. |
| Frontend | **React + Vite + TypeScript** | Fast, lightweight SPA; **TanStack Query** gives clean server-state with loading/error/empty handling for free. |
| Auth | **JWT (mocked users)** | The brief says not to over-invest in auth; this is enough to demonstrate authn/authz cleanly. |
| Deployment | **Docker Compose** | One command brings up db + cache + api + web, fully self-contained. |

### Notable design decisions (X over Y)

- **Explicit state-machine table over scattered `if` checks.** All transitions,
  their allowed roles and ownership rules live in one declarative
  [`workflow.ts`](api/src/modules/billing-requests/workflow.ts). One source of
  truth, trivially unit-testable, and reused to tell the UI which actions are
  available.
- **Audit written in the same transaction as the state change.** An action and
  its audit record can never diverge. `AuditService.record()` accepts a Prisma
  transaction client for exactly this.
- **Money stored as integer cents.** Avoids floating-point drift; conversion to
  decimals happens only at the API boundary.
- **Repository layer over Prisma-in-services.** Services depend on a narrow
  data-access boundary, which keeps business logic pure and easy to mock in
  tests.
- **Read/write connection splitting.** Writes/transactions hit the primary; reads
  round-robin across replicas (with single-DB fallback). See
  [Read/write database splitting](#readwrite-database-splitting).
- **Global auth, opt-out per route.** `JwtAuthGuard` is global; public endpoints
  (login, health, demo-users) opt out with `@Public()`. Secure by default.
- **Async invoice generation over inline.** Approval stays fast; the heavier,
  failure-prone work is retried independently.

---

## Data model

```
┌──────────────┐         ┌────────────────────────┐         ┌──────────────┐
│    User      │         │    BillingRequest      │         │   Invoice    │
├──────────────┤         ├────────────────────────┤         ├──────────────┤
│ id (uuid)    │◄───┐    │ id (uuid)              │    ┌───►│ id (uuid)    │
│ email (uniq) │    ├────┤ createdById  (FK)      │    │    │ number (seq) │
│ name         │    └────┤ reviewedById (FK,null) │    │ 1:1│ amountCents  │
│ role (enum)  │         │ number (seq → ref)     │────┘    │ status(enum) │
│ passwordHash │         │ title, customerName    │         │ dueDate      │
└──────┬───────┘         │ amountCents, currency  │         │ paidAt       │
       │                 │ status (enum)          │         └──────────────┘
       │                 │ rejectionReason        │
       │                 └───────────┬────────────┘
       │ actor (FK,null)             │ 1:N
       │                 ┌───────────▼────────────┐
       └─────────────────┤        AuditLog        │
                         ├────────────────────────┤
                         │ action (enum)          │
                         │ fromStatus, toStatus   │
                         │ note, metadata (json)  │
                         │ actorId (FK, nullable) │  ← null = system action
                         │ createdAt              │
                         └────────────────────────┘
```

- **`number`** columns are DB auto-increment sequences; the human-friendly
  `BR-2026-0001` / `INV-2026-0001` references are derived from them (race-free).
- **`AuditLog.actorId` is nullable** so system-generated actions (async invoice
  generation) are represented honestly as having no human actor.
- Enums (`Role`, `BillingRequestStatus`, `InvoiceStatus`, `AuditAction`) are
  enforced at the database level.

Full schema: [`api/prisma/schema.prisma`](api/prisma/schema.prisma).

---

## The workflow state machine

```
            submit (Sales, owner)          approve (Accounts)
   ┌───────┐ ───────────────────► ┌───────────┐ ──────────────► ┌──────────┐
   │ DRAFT │                      │ SUBMITTED │                 │ APPROVED │
   └───────┘ ◄───────────────────  └───────────┘                 └────┬─────┘
       ▲      resubmit (Sales,owner)     │                            │ system
       │                                 │ reject (Accounts)          │ (async)
       │                                 ▼                            ▼
       │                           ┌──────────┐                 ┌──────────┐
       └───────────────────────────┤ REJECTED │                 │ INVOICED │
                  resubmit          └──────────┘                 └──────────┘
```

| Action | From → To | Role | Ownership |
| --- | --- | --- | --- |
| `submit` | DRAFT → SUBMITTED | Sales | owner |
| `approve` | SUBMITTED → APPROVED | Accounts | — |
| `reject` | SUBMITTED → REJECTED | Accounts | — |
| `resubmit` | REJECTED → DRAFT | Sales | owner |
| *(system)* invoice | APPROVED → INVOICED | system worker | — |

Invalid transitions return **409 Conflict**; role/ownership violations return
**403 Forbidden**. Drafts are the only editable state; `INVOICED` is terminal.

---

## API reference

Base URL: `/api/v1`. All responses are JSON. All endpoints require a
`Authorization: Bearer <token>` header **except** those marked _public_.

### Auth

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | `{ email, password }` → `{ accessToken, user }` |
| GET | `/auth/me` | any | Current principal from the token |
| GET | `/auth/demo-users` | public | Seeded accounts for the demo login screen |

### Billing requests

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/billing-requests` | Sales | Create a draft |
| GET | `/billing-requests?status=&mine=&page=&pageSize=` | any | List (Sales auto-scoped to own) |
| GET | `/billing-requests/:id` | any* | Get one |
| GET | `/billing-requests/:id/audit` | any* | Full audit trail |
| PATCH | `/billing-requests/:id` | Sales (owner) | Edit a draft |
| POST | `/billing-requests/:id/submit` | Sales (owner) | DRAFT → SUBMITTED |
| POST | `/billing-requests/:id/approve` | Accounts | SUBMITTED → APPROVED (+ enqueue invoice) |
| POST | `/billing-requests/:id/reject` | Accounts | `{ reason }`, SUBMITTED → REJECTED |
| POST | `/billing-requests/:id/resubmit` | Sales (owner) | REJECTED → DRAFT |

`*` Sales users may only view their own requests.

### Invoices

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/invoices` | any | List (Sales auto-scoped to own) |
| GET | `/invoices/:id` | any* | Get one |
| POST | `/invoices/:id/mark-paid` | Accounts | ISSUED → PAID |

### Metrics & health

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| GET | `/metrics/summary` | any | Dashboard counts/totals (Sales scoped to self) |
| GET | `/health` | public | Liveness + DB check |

### Example

```bash
# Login
curl -s http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"sales@flowdesk.dev","password":"password123"}'

# Create a request (use the token from above)
curl -s http://localhost:3000/api/v1/billing-requests \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Consulting","customerName":"Acme","amount":1500.00}'
```

### Error envelope

Every error has the same shape:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Cannot approve a request in status DRAFT; expected SUBMITTED",
  "path": "/api/v1/billing-requests/<id>/approve",
  "timestamp": "2026-06-10T05:15:43.811Z"
}
```

---

## Project structure

```
flowdesk/
├─ docker-compose.yml          # postgres + redis + api + web
├─ docker-compose.replica.yml  # optional: real primary + streaming read replica
├─ docker/                     # postgres replication init/entrypoint scripts
├─ .env.example                # optional overrides (defaults are baked in)
├─ docs/
│  ├─ ARCHITECTURE.md          # diagrams, data flow, design rationale
│  └─ lead_full_stack_take_home_tests.md.pdf
├─ api/                        # NestJS backend (feature-based modules)
│  ├─ prisma/
│  │  ├─ schema.prisma         # data model
│  │  ├─ migrations/           # versioned SQL migrations
│  │  └─ seed.ts               # demo data
│  ├─ src/
│  │  ├─ common/               # prisma service, exception filter, utils, types
│  │  ├─ config/               # typed config + env validation (Joi)
│  │  └─ modules/
│  │     ├─ auth/              # JWT, guards, decorators, RBAC
│  │     ├─ users/
│  │     ├─ billing-requests/  # controller · service · repository · workflow
│  │     ├─ invoices/          # service · repository · BullMQ processor
│  │     ├─ audit/             # append-only audit trail
│  │     ├─ metrics/           # dashboard aggregates
│  │     ├─ queue/             # BullMQ wiring + job constants
│  │     └─ health/
│  ├─ test/                    # Jest + supertest e2e (boots the real app)
│  ├─ Dockerfile               # multi-stage build
│  └─ docker-entrypoint.sh     # migrate deploy → seed → start
└─ web/                        # React + Vite + TS SPA
   ├─ e2e/                     # Playwright browser-driven E2E tests
   ├─ src/
   │  ├─ api/                  # axios client, typed hooks (react-query)
   │  ├─ auth/                 # auth context
   │  ├─ components/           # layout, states, badges, route guard
   │  ├─ pages/                # login, dashboard, requests, invoices
   │  └─ lib/                  # formatting helpers
   ├─ Dockerfile               # build → nginx
   └─ nginx.conf               # static serving + /api proxy + SPA fallback
```

Modules are **feature-based**, not file-type-based. Each domain module owns its
controller (HTTP only), service (business logic), repository (persistence) and
DTOs.

---

## Local development (without Docker)

Requires Node 22 and a local Postgres + Redis (or just run those two via
`docker compose up postgres redis`).

```bash
# Backend
cd api
cp .env.example .env                # adjust DATABASE_URL / REDIS_HOST if needed
npm install
npx prisma migrate deploy           # or: npx prisma migrate dev
npm run db:seed
npm run start:dev                    # http://localhost:3000/api/v1

# Frontend (separate terminal)
cd web
npm install
npm run dev                          # http://localhost:5173 (proxies /api → :3000)
```

> Note: on paths containing spaces, the `npx` shim can misresolve on Windows;
> invoke binaries via `node ./node_modules/<pkg>/...` if you hit that.

---

## Testing

Unit tests cover the **core business logic** — the part most worth protecting:

- `workflow.spec.ts` — the state-machine transition table, available actions and
  status predicates (pure, no IO).
- `billing-requests.service.spec.ts` — create/approve/reject/submit rules:
  invalid-transition → 409, wrong-role → 403, non-owner → 403, and that approval
  enqueues the invoice job.
- `invoices.service.spec.ts` — async invoice generation: **idempotency**, the
  APPROVED → INVOICED transition, and refusal to invoice a non-approved request.

```bash
cd api && npm test
# 3 suites, 19 tests
```

### Backend end-to-end tests (Jest + supertest)

[`api/test/workflow.e2e-spec.ts`](api/test/workflow.e2e-spec.ts) boots the **real
Nest application** (controllers, guards, Prisma, the BullMQ worker) and drives it
over HTTP with supertest. It covers health, authentication (incl. 401s), input
validation + the consistent error envelope, RBAC (403s), the **full lifecycle**
(create → submit → approve → *async* invoice → mark paid → audit trail), and
visibility scoping — 8 tests in total.

It needs Postgres + Redis reachable and the demo data seeded:

```bash
# Easiest: bring the stack up so the DB is migrated + seeded, then:
cd api && npm run test:e2e
```

The suite reads `DATABASE_URL` / `REDIS_HOST` / `REDIS_PORT` (see
`test/setup-e2e.ts`), defaulting to `localhost:5432` / `localhost:6379`. If your
machine already runs Postgres on 5432, point it at an isolated instance, e.g.:

```bash
docker run -d --name e2e_pg  -e POSTGRES_USER=flowdesk -e POSTGRES_PASSWORD=flowdesk \
  -e POSTGRES_DB=flowdesk -p 55432:5432 postgres:16-alpine
docker run -d --name e2e_redis -p 56379:6379 redis:7-alpine
cd api
DATABASE_URL=postgresql://flowdesk:flowdesk@localhost:55432/flowdesk?schema=public \
  node ./node_modules/prisma/build/index.js migrate deploy
DATABASE_URL=postgresql://flowdesk:flowdesk@localhost:55432/flowdesk?schema=public \
  npm run db:seed
DATABASE_URL=postgresql://flowdesk:flowdesk@localhost:55432/flowdesk?schema=public \
  REDIS_HOST=localhost REDIS_PORT=56379 npm run test:e2e
```

There is also a lightweight API **smoke script** (no test runner) that walks the
same lifecycle against an already-running stack:

```bash
# with the stack running:
cd api && node e2e-smoke.mjs
```

### Frontend end-to-end tests (Playwright)

A real browser-driven suite in [`web/e2e`](web/e2e) exercises the UI through the
full workflow against the running app: the happy path (create → submit → approve
→ async invoice → mark paid), the reject → revise loop, RBAC (Sales can't
approve, Manager is read-only), and the dashboard.

```bash
# with the stack running (web on :8080):
cd web
npm run test:e2e:install   # one-time: download Chromium
npm run test:e2e           # 4 tests
# Target a vite dev server instead: E2E_BASE_URL=http://localhost:5173 npm run test:e2e
```

---

## Security & access control

- **Authentication:** JWT bearer tokens; global `JwtAuthGuard`, opt-out via
  `@Public()`. Passwords hashed with bcrypt; login returns a generic error for
  both unknown email and wrong password (no user enumeration).
- **Authorization:** declarative `@Roles()` + `RolesGuard`, *plus* ownership
  checks in the service layer (a Sales user can only act on their own requests).
  Defense in depth — the controller declares the role, the service enforces the
  invariant.
- **Visibility scoping:** Sales users only ever see their own requests, invoices
  and metrics; Accounts/Manager see everything.
- **Input validation:** global `ValidationPipe` with `whitelist` +
  `forbidNonWhitelisted`; typed DTOs with `class-validator`.
- **Config validation:** the app refuses to boot without a valid environment
  (Joi schema), so a missing `JWT_SECRET`/`DATABASE_URL` fails fast.

---

## Assumptions

- **Auth is intentionally lightweight.** Per the brief ("do not build
  authentication perfectly"), there is no refresh-token rotation, password reset
  or registration UI — seeded users are sufficient to demonstrate authn/authz.
- **Single currency per request, no FX.** Currency is stored but not converted.
- **Approval auto-generates exactly one invoice** for the full request amount
  (no partial billing / line items).
- **"Notifications" are simulated** as structured log lines from the worker
  rather than real email/Slack.
- **Demo secrets are committed on purpose** (`JWT_SECRET` default, demo
  passwords) so a reviewer can run everything with zero setup. These are clearly
  marked and would never ship to production.
- **Seed is destructive for transactional data** (it clears requests/invoices/
  audit then re-creates them) but upserts users, so re-running gives a clean,
  predictable dataset.

---

## What I'd improve with more time

- **Integration tests** against a real (test-container) Postgres + Redis, plus a
  React Testing Library pass on the key pages.
- **Approval rules engine** — e.g. amounts over a threshold require a Manager
  co-approval; configurable per customer.
- **Real notifications** (email/webhook) behind the existing worker, and a
  notifications table.
- **Optimistic concurrency** (a `version` column) to prevent two reviewers acting
  on the same request simultaneously.
- **Richer reporting**: trend charts, CSV/PDF invoice export, ageing buckets for
  outstanding invoices.
- **OpenAPI/Swagger** generated from the DTOs, and request/response examples.
- **Observability**: structured JSON logs, request IDs, and queue dashboards
  (Bull Board).
- **Refresh tokens + proper user management** if auth became central.

---

## AI-assisted development note

This solution was built with AI assistance (Claude Code). I directed the
architecture and design decisions, reviewed every file as I would my own PR, and
**verified the result by actually running it**: the unit suite passes (19 tests),
and the full stack was brought up with `docker compose up --build` and driven
end-to-end through the complete lifecycle (the smoke test above). Two real issues
surfaced during that verification — a Prisma engine target mismatch on Alpine and
a TypeScript build-output path bug — and both were diagnosed and fixed before
this was considered done. I own all of the code, architecture and documentation
here.
