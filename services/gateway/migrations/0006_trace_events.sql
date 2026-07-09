-- Applied to Neon (project flat-bar-88026701) on 2026-07-09 via the Neon MCP
-- migration flow (verified on a temporary branch, then merged to main).
-- Milestone 5a: persisted agent-trace events (also the agent-activity audit trail).

CREATE TABLE trace_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seq int NOT NULL,
  type text NOT NULL,
  message text NOT NULL,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, seq)
);
CREATE INDEX trace_events_run_id_seq_idx ON trace_events (run_id, seq);
