# PostgreSQL migration foundation

`001_initial_schema.sql` defines the first relational schema for IIA users, quizzes, attempts, uploaded-document metadata, API keys, payment orders, and subscriptions.

## Important status

This is a schema foundation, not a completed database migration. The running application still imports the JSON-backed store from `apps/server/src/data/store.ts`. Do not set a production database URL or change deployment traffic based on this file alone.

## Before application cutover

1. Add and lock a supported PostgreSQL driver and configure TLS/connection pooling.
2. Build a one-shot importer that reads a consistent JSON snapshot and preserves existing IDs, password hashes, API-key hashes, payment states, and timestamps.
3. Preflight referential integrity and normalized-email duplicates; stop rather than silently discard or rewrite conflicting records.
4. Test dry-run counts and per-table checksums against a copy of production data.
5. Test transactionality, idempotency, and rollback on a disposable PostgreSQL instance.
6. Convert store call sites to asynchronous repository methods and test owner isolation, payment idempotency, concurrent writes, and restart recovery.
7. Back up the JSON store and uploaded files before cutover; retain a documented rollback window.
8. Keep uploaded file bytes in private object storage or a shared durable volume. The `object_key` column is metadata only; this migration does not upload files.

The schema deliberately uses text IDs to preserve the current application's IDs during migration. Legacy nullable quiz/document ownership is allowed; new write paths should require authenticated owners where appropriate.


## Read-only JSON preflight

Before building/running an importer, validate a protected copy of the existing JSON snapshot:

```sh
node scripts/preflight-json-migration.cjs /secure/path/store.json
```

The command only reads the file. It reports record counts, structural errors, duplicate normalized emails/IDs, and broken references without printing record values or secrets. It does not connect to PostgreSQL, upload document files, import data, or prove that all legacy values fit the target schema. Resolve every error and review every warning before writing an importer. Run it against a consistent snapshot, not a live file being modified by the app.
