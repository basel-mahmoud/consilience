-- Applied to Neon (project flat-bar-88026701) on 2026-07-08 via the Neon MCP
-- migration flow (verified on a temporary branch, then merged to main).
-- Owner: mesh (results) + gateway (run creation). All access scoped by user_id.

CREATE TABLE runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  summary text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX runs_user_id_created_idx ON runs (user_id, created_at DESC);

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  position int NOT NULL,
  url text NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sources_run_id_idx ON sources (run_id);

CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  position int NOT NULL,
  text text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('high','mid','low')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claims_run_id_idx ON claims (run_id);

CREATE TABLE claim_sources (
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  PRIMARY KEY (claim_id, source_id)
);
