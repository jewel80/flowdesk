# FlowDesk — Architecture & Design Note

A short, focused explanation of how FlowDesk is put together, the data flow, and
the trade-offs behind the decisions. For setup, API docs and the data model see
the root [`README.md`](../README.md).

## 1. Shape of the system

FlowDesk is a monorepo with two deployables and two backing services, all
orchestrated by Docker Compose:

| Component | Tech | Responsibility |
| --- | --- | --- |
| `web` | React + Vite SPA behind nginx | UI; serves static assets and proxies `/api` to the backend |
| `api` | NestJS (Node/TS) | Domain logic, REST API, **and** the in-process invoice worker |
| `postgres` | PostgreSQL 16 | System of record: workflow state + audit trail |
| `redis` | Redis 7 | BullMQ job queue backing async invoice generation |

The API and the worker share one Node process. For a module this size that keeps
operations simple while still proving the async pattern; splitting the worker
into its own container is a one-line Compose change (documented in §6).

## 2. Backend layering

Each feature module follows a strict **Controller → Service → Repository**
separation, with cross-cutting concerns handled by guards, pipes and a filter:

```
            ┌──────────────────────── request ─────────────────────────┐
            ▼                                                           │
   ValidationPipe (DTO)                                                 │
            ▼                                                           │
   JwtAuthGuard  ──► RolesGuard                                         │
            ▼                                                           │
   ┌─────────────┐   thin: routing & HTTP only, zero business logic    │
   │ Controller  │                                                     │
   └──────┬──────┘                                                     │
          ▼                                                            │
   ┌─────────────┐   workflow rules, ownership, orchestration,        │
   │  Service    │   transactions, enqueue jobs                        │
   └──────┬──────┘                                                     │
          ▼                                                            │
   ┌─────────────┐   the only place that talks to Prisma              │
   │ Repository  │                                                     │
   └──────┬──────┘                                                     │
          ▼                                                            │
      PostgreSQL                                                       │
            └──────── AllExceptionsFilter (uniform error envelope) ───┘
```

- **Controllers** declare routes and required roles (`@Roles`) and nothing else.
- **Services** hold all business rules. They validate transitions against the
  state machine, enforce ownership, write audit entries, and decide what to
  enqueue. This is what the unit tests target.
- **Repositories** are the single data-access boundary. They accept an optional
  Prisma transaction client so a state change and its audit row commit atomically.

## 3. The workflow as data, not control flow

The transition rules live in one declarative table
(`billing-requests/workflow.ts`):

```ts
WORKFLOW_ACTIONS = {
  submit:   { from: DRAFT,     to: SUBMITTED, allowedRoles: [SALES],    requiresOwnership: true  },
  approve:  { from: SUBMITTED, to: APPROVED,  allowedRoles: [ACCOUNTS], requiresOwnership: false },
  reject:   { from: SUBMITTED, to: REJECTED,  allowedRoles: [ACCOUNTS], requiresOwnership: false },
  resubmit: { from: REJECTED,  to: DRAFT,     allowedRoles: [SALES],    requiresOwnership: true  },
}
```

`performAction()` in the service is a single generic guarded transition that
reads this table: it checks current status (→ 409 on mismatch), role (→ 403),
ownership (→ 403), then applies the update and audit entry in one transaction.
Adding a new transition is a data change, not new branching. The same table
drives `availableActions(status)`, which the API returns so the UI knows which
buttons to show without duplicating the rules.

## 4. Synchronous vs. asynchronous data flow

**Approval is the interesting path.** Doing invoice generation inline would couple
a fast user action to slower, failure-prone work. Instead:

```
Accounts clicks Approve
   │
   ├─ Service: SUBMITTED → APPROVED  (transaction: update + audit)   ── fast, returns now
   │
   └─ enqueue "generate-invoice" { billingRequestId, approvedByUserId }
                                   │
                                   ▼  (BullMQ / Redis)
                          Invoice worker
                                   │
                                   └─ transaction:
                                        • create Invoice (ISSUED, due in N days)
                                        • BillingRequest → INVOICED
                                        • audit INVOICE_GENERATED (actor = approver)
                                      then log a simulated notification
```

Properties that make this production-shaped rather than decorative:

- **Idempotent worker.** If the job is retried, it finds the existing invoice for
  the request and no-ops — no duplicate invoices.
- **Retries with backoff.** The queue is configured with 3 attempts and
  exponential backoff; transient DB/Redis blips self-heal.
- **Atomicity.** Invoice creation + status flip + audit are one transaction, so
  you never see an `INVOICED` request without an invoice (or vice versa).
- **Honest actorship.** The audit entry records the approver as the actor even
  though a background worker performed it; truly system-only actions use a null
  actor.

## 5. Read/write connection splitting

The data layer separates the **write** path from the **read** path so the system
can scale reads independently for high-traffic workloads.

```
   writes / transactions          reads (round-robin)
   prisma.primary                 prisma.reader
        │                              │
        ▼                              ▼
   ┌──────────┐  WAL streaming   ┌──────────┐ ┌──────────┐
   │ PRIMARY  │ ───────────────► │ replica1 │ │ replica2 │ ...
   └──────────┘                  └──────────┘ └──────────┘
```

- `PrismaService` (`common/prisma/prisma.service.ts`) uses **composition** — it
  holds a `primary` PrismaClient and one client per replica. It deliberately does
  **not** `extends PrismaClient`: PrismaClient returns a Proxy from its
  constructor, so a subclass `this` is the unproxied target and a `reader` getter
  returning `this` would expose no model delegates.
- `reader` round-robins across replicas and **falls back to the primary** when
  none are configured (`DATABASE_REPLICA_URLS` empty), keeping the default stack
  single-Postgres and self-contained.
- Repositories make the intent explicit: `this.prisma.primary.*` for writes,
  `this.prisma.reader.*` for reads. Read methods accept an optional client so a
  read *inside a write transaction* uses the primary (correct read-after-write).
- **Consistency:** replicas are eventually consistent. The invoice worker's
  idempotency check + write run in one primary transaction, so it never makes a
  decision on stale replica data.
- A real primary+replica can be run via `docker-compose.replica.yml` (official
  Postgres streaming replication), verified with `pg_stat_replication` on the
  primary.

## 6. Consistency & integrity decisions

- **State + audit are inseparable.** Every mutation writes its audit row in the
  same transaction. The audit table is append-only by convention (no update/
  delete paths exist in the code).
- **Money as integer cents** end to end; decimals appear only at the API edge.
- **Human references are derived from DB sequences** (`BR-2026-0001`) rather than
  computed from row counts, so concurrent creates can't collide.
- **Config is validated on boot** (Joi). A missing secret fails fast instead of
  surfacing as a confusing runtime 500.

## 7. Trade-offs & where I'd extend

| Decision | Trade-off | If it needed to scale |
| --- | --- | --- |
| Worker in the API process | Simplest ops for a small module | Move `InvoiceProcessor` to a dedicated `worker` container sharing the image; Compose change only |
| JWT, seeded users | Fast to review, meets the brief | Add refresh tokens, registration, password reset, user CRUD |
| Single invoice per request | Matches the example flow | Line items + partial billing + an approval-rules engine |
| Optimistic actions in UI via react-query invalidation | Simple, correct | Add a `version` column for optimistic concurrency on concurrent reviews |
| Simulated notifications (logs) | No external deps | Real email/webhook channel behind the existing worker |

## 8. Frontend state handling

- **Server state** is owned by TanStack Query (caching, loading/error states,
  invalidation on mutations). There is no Redux — server state and a tiny auth
  context are all that's needed.
- **Auth** lives in a context that rehydrates from a stored token via `/auth/me`
  and attaches the bearer token through an axios interceptor; a 401 clears the
  token and redirects to login.
- **RBAC-aware UI**: the request detail page only renders actions the current
  role/ownership permits, mirroring (never replacing) the server-side checks.
- Every list/detail view renders explicit **loading**, **error** and **empty**
  states.
