-- Applied to Neon (project flat-bar-88026701) on 2026-07-09 via the Neon MCP
-- migration flow (verified on a temporary branch, then merged to main).
-- Milestone 3b: cross-agent contradictions and run evaluation scores.

CREATE TABLE contradictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  claim_a_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  claim_b_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  explanation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contradictions_run_id_idx ON contradictions (run_id);

CREATE TABLE run_evaluations (
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  metric text NOT NULL,
  score real NOT NULL,
  rationale text NOT NULL,
  PRIMARY KEY (run_id, metric)
);
