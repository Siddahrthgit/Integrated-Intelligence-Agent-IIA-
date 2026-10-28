# IIA readiness plan for 1,000 users

This is an engineering acceptance plan, not a claim that the current deployment already supports 1,000 users. A count of registered accounts is not the same as 1,000 simultaneous active users.

## Current known blockers

- The server persists users, quiz attempts, API keys, subscriptions, and extracted PDF text in one JSON snapshot. Each mutation serializes the full snapshot. This is a single-instance MVP store, not a safe basis for horizontal scaling or concurrent multi-instance writes.
- Uploaded PDFs are stored on a local Docker volume. Multiple app replicas would not share files unless storage is changed.
- The current CI verifies builds and container/API smoke tests; it does not measure concurrent user capacity, AI-provider quota, tail latency, or restore time.
- Gemini API quota and rate limits are separate from application capacity and must be measured/configured for expected usage.

## Required architecture before a 1,000-user public launch

1. Move transactional records to managed PostgreSQL. Use migrations, unique constraints (including normalized user email), indexes for owner/user IDs and timestamps, transactions for payment/subscription updates, and bounded connection pooling.
2. Move uploaded PDFs to private object storage. Keep only object key, owner, size, MIME/signature validation, and extracted-text metadata in the database. Use short-lived signed URLs if file download is needed.
3. Add automated encrypted database backups, object-storage retention/versioning where available, and a documented restore drill. Never treat a backup as valid until a restore has been tested.
4. Keep one application replica until the persistence migration is complete. Only scale replicas after sessions, rate limits, and background work are safe across replicas; move rate-limit counters to shared storage if multi-replica enforcement is required.
5. Add monitoring for HTTP status/latency, CPU/memory, event-loop delay, database pool saturation, storage errors, Gemini latency/quota failures, and per-plan AI usage/cost. Never log provider keys, passwords, full PDF text, or private prompts.
6. Enforce per-user and per-plan AI quotas on the server. Bound request size, PDF size/page count, output tokens, request duration, and concurrent AI jobs. Return useful retry messages on provider quota exhaustion.
7. Verify authorization for every user-owned resource, including PDFs, generated quizzes, attempts/results, payment orders, subscriptions, and API keys. Regression tests must prove user A cannot read or mutate user B's records.

## Proposed acceptance targets

These are initial test targets to validate and revise with real traffic, not guarantees:

- 1,000 registered test accounts, with randomized owner-isolation tests.
- Load test with 100 concurrent active sessions first, then 250 and 500; do not jump directly to 1,000 concurrent AI requests.
- Non-AI read endpoints: p95 under 500 ms at the agreed load, with under 1% server errors.
- Authenticated API endpoints: p95 under 800 ms at the agreed load, excluding external AI latency.
- AI tasks: bounded concurrency, timeout handling, quota/error reporting, and cost tracking; report p50/p95 separately from application latency.
- Sustained test for at least 30 minutes, plus restart/recovery test while requests are active.
- Restore a backup into a clean environment and verify user records, attempts, subscriptions, and PDF metadata.
- No critical/high security findings in auth, cross-user access, payment verification, or file upload review.

## Rollout gates

### Gate 1 — correctness and privacy
- [ ] CI backend tests, frontend build, container smoke tests pass.
- [ ] Private result-history authorization is enforced and tested.
- [ ] PDF ownership and generated-quiz ownership are tested across accounts.
- [ ] Payment callback verification and subscription idempotency are tested.

### Gate 2 — persistence and recovery
- [ ] PostgreSQL schema and migrations are implemented.
- [ ] Data migration has dry-run, counts/checksums, rollback plan, and backup.
- [ ] Object storage is configured and private by default.
- [ ] Backup restore drill succeeds.

### Gate 3 — performance and operations
- [ ] Load tests meet the measured targets above.
- [ ] Alerts and dashboards are active.
- [ ] Gemini quotas and application usage caps are configured.
- [ ] Deployment rollback and restart/recovery are verified.

### Gate 4 — controlled launch
- [ ] Start with a small invited cohort.
- [ ] Review latency, error rates, support issues, and per-user AI cost.
- [ ] Increase traffic gradually only while SLOs and cost limits remain healthy.

## Non-negotiable limitation

Do not advertise “1,000 concurrent users supported” until the database/object-storage work is deployed and a repeatable load test demonstrates it. Passing unit tests or having 1,000 accounts in a database does not prove concurrent capacity.
