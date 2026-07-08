-- Applied to Neon (project flat-bar-88026701) on 2026-07-09 via the Neon MCP
-- migration flow (verified on a temporary branch, then merged to main).
-- Milestone 3a: per-agent attribution and source credibility.

CREATE TABLE run_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  lens text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX run_agents_run_id_idx ON run_agents (run_id);

ALTER TABLE sources ADD COLUMN run_agent_id uuid REFERENCES run_agents(id) ON DELETE CASCADE;
ALTER TABLE sources ADD COLUMN credibility text CHECK (credibility IN ('high','mid','low'));
ALTER TABLE sources ADD COLUMN credibility_rationale text;

ALTER TABLE claims ADD COLUMN run_agent_id uuid REFERENCES run_agents(id) ON DELETE CASCADE;
