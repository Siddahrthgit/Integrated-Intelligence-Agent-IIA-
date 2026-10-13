# Single-container deployment

This branch packages the existing Next.js frontend and Express API into one Docker container. No public deployment or infrastructure changes are performed automatically.

## Implemented

- Root `package-lock.json`; CI and Docker use `npm ci` for reproducible dependency installs.
- Account signup/sign-in, JWT-protected chat and uploads, and per-account PDF ownership checks.
- User, quiz, attempt, and upload metadata stored in a JSON file at `DATA_FILE` (default `/app/data/store.json`); uploaded bytes persist in the `uploads_data` Docker volume.
- Gemini chat endpoint at `POST /api/chat`; configure `GEMINI_API_KEY` and optionally `GEMINI_MODEL`.
- Selectable-text PDF extraction, page-indexed text, lightweight keyword-based page retrieval, and requested page citations in PDF answers. Existing documents without page-indexed data fall back to text without reliable page citations.
- Optional web research toggle uses Gemini's Google Search grounding tool and displays source links returned in grounding metadata. It is disabled while a PDF is attached so document-only answers stay source-grounded.
- CI builds backend and frontend, builds the Docker image, and smoke-tests the container/API proxy.

## Known limitations

- Scanned-PDF OCR fallback is available in the Docker image using Poppler + Tesseract (English). It is bounded to the first 10 pages and has per-process timeouts; set `ENABLE_PDF_OCR=false` to disable it. OCR quality varies, and other languages are not installed by default.
- PDF retrieval is a small keyword-based page ranker, not semantic embeddings/vector search; long pages can be truncated. Page citations are model-generated and should be checked against the source. OCR text can contain recognition errors.
- Web research depends on the configured Gemini model/API and its available Google Search grounding support. The UI only displays source URLs returned by provider grounding metadata; it does not guarantee that every statement has a citation.
- Optional multi-step task mode plans 2–3 bounded analysis steps, runs each step through Gemini, then synthesizes a final response. It can make up to five provider calls per request and does not execute arbitrary tools or external actions. Web search and task mode are separate modes.
- User/quiz/upload metadata use a JSON file, not a transactional database. It is suitable only for a small single-instance MVP, not concurrent/high-volume production use.
- This remains an MVP rather than a security-audited production service. Bearer tokens and in-memory rate limits are used. Do not use it for highly sensitive documents or high-volume multi-instance deployment before a security review and database migration.

## Configure and run

Create `.env` from `.env.example` on the host. Generate a unique secret locally with `openssl rand -base64 48`; put it in the environment file and do not share or commit it.

```sh
docker compose build
docker compose up -d
docker compose logs -f app
curl -fsS http://127.0.0.1:3000/api/health
```

Compose binds the web app only to `127.0.0.1:3000`. Configure HTTPS at the host reverse proxy before public exposure. The named volumes `uploads_data` and `iia_data` retain uploaded bytes and application records. Avoid `docker compose down -v` because it deletes both volumes.

## Update on VPS

```sh
git fetch origin
git switch deploy/single-container
git pull --ff-only origin deploy/single-container
docker compose build
docker compose up -d
docker compose logs --tail=200 app
curl -fsS http://127.0.0.1:3000/api/health
```

## Runtime variables

- `JWT_SECRET`: production-required, unique random value of at least 32 bytes.
- `NODE_ENV=production`.
- `API_PROXY_TARGET=http://127.0.0.1:5000`: internal Next.js rewrite target, not a browser setting.
- `PORT=5000`, `WEB_PORT=3000`, `UPLOADS_DIR=/app/uploads`, and `DATA_FILE=/app/data/store.json` are set in Compose.
- `GEMINI_API_KEY`: required for chat, PDF Q&A, and optional web research; keep it server-side and never commit the real key. `GEMINI_MODEL` defaults to `gemini-2.5-flash`.

CI and Docker use `npm ci` with the committed lockfile. The Docker base image and CI use Node.js 22 LTS.
