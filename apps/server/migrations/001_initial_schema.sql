-- IIA PostgreSQL schema baseline.
-- This is a migration foundation only; the application still uses the JSON store.
-- Do not switch production traffic until a tested importer and rollback plan exist.

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_uq ON users (lower(email));

CREATE TABLE IF NOT EXISTS quizzes (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(questions) = 'array'),
  owner_user_id text REFERENCES users(id) ON DELETE SET NULL,
  source_document_id text,
  created_at timestamptz
);
CREATE INDEX IF NOT EXISTS quizzes_owner_created_idx ON quizzes (owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS uploaded_documents (
  id text PRIMARY KEY,
  filename text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  object_key text NOT NULL,
  uploaded_at timestamptz NOT NULL,
  extracted_text text,
  pages jsonb CHECK (pages IS NULL OR jsonb_typeof(pages) = 'array'),
  owner_user_id text REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS uploaded_documents_owner_uploaded_idx ON uploaded_documents (owner_user_id, uploaded_at DESC);

ALTER TABLE quizzes
  DROP CONSTRAINT IF EXISTS quizzes_source_document_id_fkey;
ALTER TABLE quizzes
  ADD CONSTRAINT quizzes_source_document_id_fkey
  FOREIGN KEY (source_document_id) REFERENCES uploaded_documents(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS attempts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id text NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total_questions integer NOT NULL CHECK (total_questions >= 0),
  percentage numeric(6,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  passed boolean NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_user_created_idx ON attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attempts_quiz_idx ON attempts (quiz_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  prefix text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS api_keys_owner_created_idx ON api_keys (owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_orders (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  plan_id text NOT NULL,
  amount_paisa bigint NOT NULL CHECK (amount_paisa >= 0),
  pidx text UNIQUE,
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
  created_at timestamptz NOT NULL,
  paid_at timestamptz,
  transaction_id text
);
CREATE INDEX IF NOT EXISTS payment_orders_user_created_idx ON payment_orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  payment_order_id text NOT NULL UNIQUE REFERENCES payment_orders(id) ON DELETE RESTRICT,
  CHECK (expires_at > starts_at)
);
CREATE INDEX IF NOT EXISTS subscriptions_expiry_idx ON subscriptions (expires_at);

COMMIT;
