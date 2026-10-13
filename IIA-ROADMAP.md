# IIA (Integrated Intelligence Agent) — Product & Engineering Roadmap

## Mission

Turn this repository into one self-hostable AI assistant named **IIA**, with one codebase and a single Docker deployment. The existing Next.js app remains the user interface and the Express/TypeScript app remains the API. Build incrementally; do not replace working application code with a copied public repository.

## Reality check: current branch

This branch currently contains a minimal Next.js + Express starter, not a complete AI agent yet.

- The API data store in `apps/server/src/data/store.ts` is in-memory. Users, quizzes, attempts, and upload metadata are lost on restart.
- PDF uploads now validate the `%PDF-` signature, extract selectable text, and can pass that text into Gemini answers. OCR for scanned PDFs, chunking/retrieval, and page-level citations remain future work.
- The app has no verified agent orchestrator, tool registry, durable conversation history, or working Gemini request path in the inspected files.
- The Docker upload volume can persist file bytes, but it does not make application records persistent.
- `GEMINI_API_KEY` must never be treated as proof that Gemini integration exists. It should be wired into a tested provider adapter.

These gaps are release blockers for a dependable public-facing service.

## Target experience

1. **Chat:** streaming-ready conversation UI with clear error states.
2. **Gemini-first model layer:** Google Gemini is the default provider. Keep model calls behind a provider interface so a provider can be changed later without rewriting the app; do not add OpenAI by default.
3. **PDF knowledge:** upload a PDF, validate its actual signature, extract text, chunk it, retrieve relevant passages, and answer using those passages with page/source references. If extraction returns no usable text, tell the user instead of pretending the file was read.
4. **Research:** add web search only through an explicit, rate-limited tool with source URLs and retrieval timestamps. Do not claim live browsing if the tool is unavailable.
5. **Agent orchestration:** define typed tools with input schemas, timeouts, bounded retries, per-request budgets, and audit logs. The model may request tools; the server validates and executes them. Never run arbitrary shell/code from a model in the API process.
6. **Memory:** store conversations and user-owned documents durably, with per-user authorization and deletion controls.
7. **Reliability:** health/readiness endpoints, structured logs, request IDs, rate limits, bounded uploads, graceful shutdown, automated tests, and CI.
8. **Deployment:** one repository and one Docker image/container for web + API. Persist data using a mounted volume. A single container is suitable for a small self-hosted deployment, but it is not high availability.

## Architecture boundaries

- `apps/web`: Next.js interface; same-origin calls to `/api/*`.
- `apps/server`: Express API, auth, orchestration, tool permissions, file processing, persistence.
- `apps/server/src/ai/providers`: provider interface and Gemini adapter.
- `apps/server/src/ai/agent`: task planner/runner and typed tool registry.
- `apps/server/src/knowledge`: PDF validation, extraction, chunking, retrieval, source references.
- `apps/server/src/db`: repository interfaces and migrations.
- `apps/server/src/routes`: versioned API routes.
- `scripts/start.cjs`: supervise web and API processes and terminate both on failure.
- Docker Compose: localhost-only port binding by default and persistent data volume.

Keep domain logic out of route handlers. Keep secrets on the server. A model response is untrusted input, not executable authority.

## Recommended public projects to evaluate

These are reference implementations and dependencies to evaluate, not permission to copy entire applications. Before adopting any code, inspect the exact repository license, maintenance status, transitive dependencies, security advisories, and compatibility with this stack.

- [Google Gen AI JavaScript SDK](https://github.com/googleapis/js-genai) — official Google Gemini API integration candidate. Use a server-side adapter and keep the API key in environment configuration.
- [LangChain.js](https://github.com/langchain-ai/langchainjs) — reference for model/tool abstractions and retrieval workflows. Prefer a small typed implementation first if adding the framework would make the app harder to operate.
- [LangGraph.js](https://github.com/langchain-ai/langgraphjs) — reference for stateful, multi-step agent workflows. Adopt only when IIA actually needs resumable/multi-step orchestration.
- [Mozilla PDF.js](https://github.com/mozilla/pdf.js) — PDF parsing/rendering reference. Select a server-compatible text-extraction library and test scanned PDFs separately; OCR is a distinct capability.
- [Vercel AI SDK](https://github.com/vercel/ai) — optional reference for streaming UI patterns. It is not required to keep the current Express backend.

Do not vendor a large public app wholesale. Reuse well-maintained packages and small, license-compliant patterns, pin versions, and document attribution when required. No public repository can make the product “perfect” by itself.

## Implementation order

### P0 — Safe, reproducible deployment
- Pin supported Node version and generate a root lockfile.
- Build frontend and backend in CI and build the Docker image.
- Verify same-origin API rewrites, health endpoint, graceful process handling, and upload volume persistence.
- Fail production startup without a strong unique JWT secret.
- Do not expose uploaded private PDFs through an unrestricted static URL.

### P1 — Durable core
- Replace the current JSON-file prototype store with a transactional database (SQLite for a small single-instance deployment, or PostgreSQL for multi-instance growth) behind repository interfaces.
- Add migrations, password/auth tests, per-user authorization, request rate limits, and secure upload ownership.
- Ensure uploaded files and database metadata can be backed up and restored.

### P2 — Real Gemini chat
- Add the official Google Gen AI SDK adapter.
- Validate missing/invalid keys and upstream quota/timeout errors.
- Add a chat API with bounded request sizes and useful user-facing error messages.
- Add tests using a mocked provider; do not require paid API calls in CI.

### P3 — PDF knowledge and grounded answers
- Verify PDF content signature and size limits; use safe generated filenames.
- Extract text and page boundaries, chunk with overlap, index per user, and retrieve relevant chunks.
- Require the answer to cite retrieved pages/snippets and admit when sources do not support an answer.
- Add fixtures for normal PDFs, empty/scanned PDFs, malformed files, oversized files, and cross-user access attempts.

### P4 — Controlled tools and research
- Add one tool at a time with schemas, allowlists, timeouts, budget limits, and tests.
- Web search results must include URLs and dates where available.
- Any side-effecting tool requires explicit user confirmation. Never let retrieved web pages or documents override system security rules.

### P5 — Product polish
- Conversation history, document library, export/share controls, accessibility, mobile layout, usage limits, telemetry with privacy controls, and clear onboarding.
- Add evaluation sets for answer correctness, citations, refusal behavior, latency, and cost/quota usage.

## Definition of done

Do not call IIA production-ready until all of these are true:

- Clean checkout installs from the lockfile.
- CI passes backend tests, frontend checks/build, and Docker build.
- Container starts with documented environment variables and refuses insecure production secrets.
- `/api/health` and readiness checks behave correctly.
- A PDF remains available after container restart when the data volume is mounted.
- User/account/chat/document metadata survives restart in durable storage.
- One real Gemini chat round-trip works with a configured key; automated tests use a mock.
- PDF questions are grounded in extracted content with source references.
- Authorization, malformed upload, rate limit, timeout, and cross-user isolation tests pass.
- No API keys or personal data are committed to the repository.

## Free-tier and cost reality

The source code and local Docker runtime can be free. AI inference, web search, hosted databases, storage, and public hosting may have quotas, usage charges, or availability limits. This plan avoids requiring a paid orchestration platform, but it cannot promise unlimited free AI usage or free always-on hosting.
