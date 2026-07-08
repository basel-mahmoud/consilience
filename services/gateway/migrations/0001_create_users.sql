-- Applied to Neon (project flat-bar-88026701) on 2026-07-08 via the Neon MCP
-- migration flow (verified on a temporary branch, then merged to main).
-- Owner: gateway. Records Clerk users on first authenticated request.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL UNIQUE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
