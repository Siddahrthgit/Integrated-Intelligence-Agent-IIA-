## Read-only load test

Use a staging deployment with dedicated test accounts. This script only performs GET requests to health, quiz-list, and result-list endpoints. It does not create data, upload files, or call Gemini.

Example:

```sh
LOAD_TEST_BASE_URL=https://staging.example.com \
LOAD_TEST_TOKENS="JWT_FOR_TEST_ACCOUNT_1,JWT_FOR_TEST_ACCOUNT_2,JWT_FOR_TEST_ACCOUNT_3" \
LOAD_TEST_CONCURRENCY=100 \
LOAD_TEST_REQUESTS=3000 \
node scripts/load-test-readonly.cjs
```

Use several unique test-account JWTs to exercise account isolation and avoid treating one account as 100 different users. Increase concurrency in steps (25, 50, 100, 250, 500) and watch CPU/memory, application logs, database/disk I/O, Gemini usage, and p95 latency. This harness does not test AI generation or upload/OCR throughput and does not prove 1,000 concurrent-user capacity by itself. Do not point write-enabled or AI load tests at production.
