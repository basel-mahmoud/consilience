-- Applied to Neon (project flat-bar-88026701) on 2026-07-09 via the Neon MCP
-- migration flow (verified on a temporary branch, then merged to main).
-- Milestone 4a: allow the engine to mark rate-limited runs.

ALTER TABLE runs DROP CONSTRAINT runs_status_check;
ALTER TABLE runs ADD CONSTRAINT runs_status_check
  CHECK (status IN ('queued','running','completed','failed','rate_limited'));
