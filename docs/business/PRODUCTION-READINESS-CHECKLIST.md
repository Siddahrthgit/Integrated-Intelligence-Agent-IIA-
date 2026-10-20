# IIA Business Assistant — Production Readiness Checklist

This checklist is a release gate, not a statement that the repository currently passes. Record evidence for each item. Do not use sensitive client data until the relevant controls are tested.

## A. Application and deployment

- [ ] Confirm exact branch/commit intended for testing.
- [ ] Clean install succeeds using the documented Node/npm versions.
- [ ] Frontend and backend builds pass.
- [ ] Automated tests pass; add tests for uncovered critical paths.
- [ ] Health/readiness endpoint accurately reports dependency status.
- [ ] Production configuration is documented; secrets remain server-side.
- [ ] Frontend uses configured API origin, not a hard-coded localhost URL.
- [ ] Logs do not contain API keys, full private documents, or sensitive prompts.
- [ ] Staging smoke tests cover sign-in, chat, upload, answer, errors, and mobile layout.
- [ ] Rollback procedure is documented and tested where possible.

## B. Authentication and tenant isolation

- [ ] Protected routes require authentication as intended.
- [ ] Every document, conversation, and business resource is authorized server-side.
- [ ] Cross-user and cross-business access tests fail closed.
- [ ] Session/token handling, expiration, logout, and password/reset paths are reviewed.
- [ ] Rate limits and request/body-size limits are enabled.
- [ ] CORS and security headers are restricted to expected origins.
- [ ] Administrative actions require appropriate authorization.

## C. Documents and AI responses

- [ ] Validate file types by content as well as extension; enforce size/page limits.
- [ ] Store uploads outside public web roots with private access by default.
- [ ] Use durable storage and documented retention/deletion.
- [ ] Extract text from supported PDFs; report unsupported/scanned files honestly.
- [ ] Retrieve only the current customer's authorized source material.
- [ ] Test direct and indirect prompt injection in user questions and documents.
- [ ] Treat document text as untrusted data, not instructions to the system.
- [ ] Show sources where available and use a fallback for unsupported answers.
- [ ] Test empty, malformed, oversized, and adversarial inputs.
- [ ] Never execute model-generated code or external actions without explicit controls and authorization.

## D. Data and operations

- [ ] Durable database configured; persistence survives restart.
- [ ] Backups run and a restore test has been completed.
- [ ] Error monitoring and alerting work.
- [ ] Timeouts, retry policy, provider errors, and quota exhaustion are handled.
- [ ] Per-customer usage and model cost are recorded without exposing private content.
- [ ] Per-plan quotas and abuse controls are enforced server-side.
- [ ] Incident response and customer contact process are documented.
- [ ] Privacy notice, service terms, data-processing expectations, and deletion workflow are ready.

## E. Commercial readiness

- [ ] Offer clearly states deliverables and exclusions.
- [ ] Written pilot scope and acceptance tests agreed.
- [ ] Price, taxes, payment schedule, usage caps, and third-party charges are disclosed.
- [ ] Customer content use is authorized.
- [ ] Support hours and response expectations are clear.
- [ ] No unsupported accuracy, security, compliance, or revenue claims.
- [ ] Customer approves launch and any public case study separately.

## Release decision

- **Blocked:** any critical auth, tenant isolation, secrets, document privacy, or data-loss issue is unresolved.
- **Pilot-only:** core workflow works in a controlled staging setup, but limits or operational controls still require manual supervision; use only non-sensitive/authorized data with written scope.
- **Client-ready for agreed scope:** relevant checklist items have evidence, acceptance tests pass, privacy/support terms are in place, and operating costs are measured.

A green checkbox must point to a test, log, review, or signed decision—not a guess.
