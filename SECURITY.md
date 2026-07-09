# Security

## Reporting a vulnerability

Email the maintainer (see the GitHub profile) with a description and reproduction steps. Please do not open a public issue for undisclosed vulnerabilities.

## Posture

Consilience is a portfolio-grade system built with production security practices. This document records the Milestone 6 hardening audit against the project's security checklist and where each control lives.

### Access control & data isolation

- **Ownership on every resource.** Every run, claim, source, contradiction, evaluation, and trace event is scoped by the internal `user_id` at the data layer — not just the API layer. The gateway derives `user_id` from the verified Clerk `sub` and passes it into every query's `WHERE user_id = …`; a request for another user's run returns `404`, never their data. Gateway tests cover the ownership-404 paths for run detail, approve, and reject.
- **Stateless auth.** The gateway verifies Clerk-issued JWTs against Clerk's JWKS ([ADR-004](docs/adr/004-clerk-authentication.md)) and additionally checks the token's `azp` against the approved-origin list. SignalR connections authenticate with the same token via `?access_token=` (WebSockets can't set headers), and the hub re-checks run ownership before a client joins a run's group.
- **CORS** is locked to an explicit origin allow-list (`appsettings.json`), not `*`.
- **Multi-tenancy** is enforced in SQL, so a gateway bug can't widen a query beyond the owner.

### Input validation & injection

- Research questions are length-validated (10–500 chars) at the gateway before a run is created; run IDs use a `:guid` route constraint.
- **All database access is parameterized** (Npgsql/asyncpg/JDBC prepared statements) across all three backend services — no string-built SQL.
- **Prompt-injection defense:** the mesh treats every piece of retrieved web content strictly as data; the research, extraction, synthesis, and contradiction prompts all instruct the model to ignore instructions embedded in sources.
- Request bodies are capped at 64 KB.

### Rate limiting & abuse protection

- **Per-caller request rate limit** at the gateway (fixed window, partitioned by Clerk `sub` or remote IP), returning `429` when exceeded.
- **Per-user concurrency cap**: at most 3 active runs (gateway, immediate `429`).
- **Per-user throughput cap**: the Java engine enforces a sliding one-hour window and marks over-cap runs `rate_limited` before any LLM cost is incurred.

### Secrets & transport

- No secrets in the repo: `.env*` is gitignored, keys live in environment variables and the host's secret store, and every commit is scanned for secrets before pushing. `.env.example` documents required variables without values.
- TLS terminates at the host (Vercel for the web app); Postgres connections use `sslmode=require`. Local development runs plain HTTP on `localhost` only.

### Response hardening

- Security headers on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a locked `Permissions-Policy`, and a `Content-Security-Policy` denying framing (the gateway serves only JSON and a WebSocket hub).
- Production uses generic problem-details errors — stack traces are never returned to clients.

### Reliability & resilience

- **Retry with exponential backoff** on all external calls: LLM calls (mesh), broker dispatch (engine), and the trace relay's broker connection.
- **Graceful degradation:** a multi-agent run completes on surviving agents if some fail; contradiction detection and synthesis failures don't sink a run; the web app runs in web-only mode when the gateway is unreachable.
- **Idempotency:** the mesh claims each run once (redelivery-safe), and trace-event persistence is idempotent on `(run_id, seq)`.
- Recovery targets and the rollback plan are in [docs/disaster-recovery.md](docs/disaster-recovery.md).

### Observability & audit

- Structured JSON logging with levels across all three services; tokens and PII are never logged.
- The `trace_events` table is an append-only, per-run audit trail of agent activity.

### Supply chain

- **Dependabot** covers npm, NuGet, uv, Gradle, and GitHub Actions.
- **CodeQL** static analysis runs on every push/PR and weekly across all four languages (TypeScript, Python, C#, Java).

### PII & data minimization

- User PII lives primarily in Clerk; our tables store only the Clerk user ID and email. Research content is owned by the submitting user. Account deletion and retention are addressed in the Milestone 8 compliance pass.

## Known limitations (portfolio scope)

- Backend services are not yet publicly hosted; the deployed web app runs in web-only mode.
- Field-level encryption at rest is deferred (Neon encrypts at rest at the platform level).
- A formal WAF and DDoS protection are out of scope for the portfolio deployment.
