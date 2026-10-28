# PostgreSQL Application Cutover Plan

## Status

Planning gate only. The live application still uses the synchronous JSON store in `apps/server/src/data/store.ts`. The SQL schema and JSON importer are migration foundations; they do not make application requests use PostgreSQL. Do not announce a database cutover or 1,000-user readiness until the acceptance gates below pass.

## Why a direct switch is unsafe

The current store exports mutable arrays (`users`, `quizzes`, `attempts`, `uploadedDocuments`, `apiKeys`, `paymentOrders`, `subscriptions`) and synchronous helpers. Controllers read those arrays directly. PostgreSQL calls are asynchronous, and operations such as signup, quiz creation, attempt recording, API-key rotation, and payment confirmation need explicit concurrency/transaction handling. Merely adding a PostgreSQL connection or importing the snapshot would leave production traffic on JSON.

## Cutover sequence

### Gate 0 — Preserve rollback and inventory
- Back up the JSON store and uploaded files separately; record file sizes, timestamps, and checksums.
- Run the migration preflight and importer in dry-run mode against a copy of the production snapshot.
- Confirm all current store fields and every direct array import/call site are inventoried.
- Do not run the importer against production as part of application deployment.

### Gate 1 — Async repository contract
- Define typed async repository interfaces for each domain: users, quizzes, attempts, uploaded documents, API keys, payment orders, subscriptions.
- Keep controllers dependent on interfaces, not SQL or mutable arrays.
- Implement a JSON adapter first so behavior can be regression-tested before changing the persistence engine.
- Convert one vertical slice at a time. Every call site must await the repository operation; remove direct array access for that slice.
- Do not create a “repository” wrapper that still exposes mutable arrays.

### Gate 2 — PostgreSQL adapter
- Add the PostgreSQL driver and update the root lockfile in the same tested change.
- Implement parameterized SQL for the repository contract, with row-to-domain mapping and clear error handling.
- Use database constraints for unique normalized user email, foreign keys, valid statuses, and idempotency keys where applicable.
- Use transactions for related writes: user creation, quiz plus attempt flows where applicable, API-key rotation, and payment settlement plus subscription creation.
- Never store plaintext API keys or passwords. Preserve existing password hashes and API-key hash semantics.

### Gate 3 — Upload storage
- Decide on durable shared object storage before switching uploaded-document metadata.
- Migrate actual file bytes, not just document rows or URLs. Verify each object's checksum and read permissions.
- Keep metadata and object references consistent; failed uploads must not leave orphaned database records, and failed database writes must not publish a usable object reference.

### Gate 4 — Tests and staging
- Run server TypeScript build and all existing tests.
- Add repository contract tests that run against both JSON and PostgreSQL adapters.
- Add PostgreSQL integration tests for duplicate signup races, concurrent quiz/attempt writes, API-key rotation/revocation, payment webhook retries, and subscription idempotency.
- Test migrations against an empty database and a realistic copied snapshot; validate row counts, relationships, and representative fields.
- Exercise backup restoration and a rollback rehearsal before production cutover.

### Gate 5 — Controlled production cutover
- Take a fresh backup and briefly stop writes or use a documented maintenance window; do not dual-write to JSON and PostgreSQL.
- Import the validated snapshot once, including a verified uploaded-file migration.
- Start the application in PostgreSQL mode only after schema and data checks pass.
- Verify health/readiness, signup/login, quiz creation, attempt results, document upload/read, API-key lifecycle, and payment/subscription reconciliation.
- Keep the JSON backup immutable for rollback. Rollback must stop writes first and explicitly account for writes made after cutover; never blindly restore an old JSON snapshot over newer data.

## 1,000-user readiness gates

A database migration alone does not prove capacity. Before claiming support for 1,000 users:
- Replace per-process rate-limit state with a shared limiter suitable for multiple instances.
- Bound Gemini concurrency, request timeouts, retries, token/output budgets, and per-account spending; protect against retry storms.
- Add structured logs, request IDs, error-rate/latency metrics, database pool limits, and alerts without logging secrets or personal document contents.
- Run staged tests at increasing concurrency (for example 25, 100, 250, 500, then 1,000 virtual users), including authenticated write paths, uploads, and Gemini-backed generation—not only health/read endpoints.
- Define and publish pass/fail thresholds before testing. Record p95 latency, error rate, database pool saturation, memory/CPU, provider quota/errors, and cost.
- Verify backup recovery and graceful behavior when PostgreSQL or Gemini is unavailable.

## Immediate next implementation task

Start Gate 1 with the users/auth vertical slice: introduce the async user repository contract and JSON adapter, update signup/login to await it, and add tests for normalized email and duplicate signup handling. Keep PostgreSQL disabled until that slice and its contract tests pass. Then continue to quizzes/results, API keys, payments/subscriptions, and uploaded documents in separate reviewable changes.
