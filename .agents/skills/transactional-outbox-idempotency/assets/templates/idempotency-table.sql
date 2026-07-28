-- Generic template. Do not apply without adapting and reviewing.
CREATE TABLE idempotency_keys (
  scope text NOT NULL,
  key text NOT NULL,
  request_fingerprint text NOT NULL,
  status text NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);
