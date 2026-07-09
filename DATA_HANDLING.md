# Data handling & compliance

A complete inventory of every data point Consilience collects, where it lives, why, and how long it is kept. This is the authoritative reference behind the in-app [privacy policy](apps/web/src/app/(legal)/privacy/page.tsx).

## Data inventory

| Data point | Source | Where stored | Purpose | Retention |
|---|---|---|---|---|
| Email address | Clerk sign-up | Clerk; mirrored to `users.email` | Identity, account recovery | Until account deletion |
| Name (optional) | Clerk profile | Clerk | Display | Until account deletion |
| Password / credentials | Clerk sign-up | Clerk only (never seen by us) | Authentication | Managed by Clerk |
| Clerk user ID | Clerk JWT `sub` | `users.clerk_user_id` | Tenancy anchor for all owned data | Until account deletion |
| Session / access tokens | Clerk | Browser (short-lived), verified statelessly | Authenticated requests | Short-lived; refreshed by Clerk |
| Research questions | User input | `runs.question` | The research to perform | Until user/account deletion |
| Research results | Generated | `claims`, `sources`, `contradictions`, `run_evaluations` | The report you revisit/export | Until user/account deletion |
| Agent trace | Generated | `trace_events` | Live trace + agent-activity audit trail | Until run/account deletion |
| IP address | Request metadata | In-memory rate-limiter only | Rate limiting / abuse protection | Transient; not durably logged against a user |
| Last-seen timestamp | Server | `users.last_seen_at` | Operational | Until account deletion |

We do **not** collect: third-party advertising/analytics identifiers, device fingerprints, precise geolocation, or crash/session-replay telemetry.

## Data flows

- **Auth**: Clerk holds the primary identity record. Our database stores only the Clerk user ID plus email — data minimization by design (ADR-004).
- **Research**: questions and results are written by the mesh and read by the gateway, always scoped by the internal `user_id`.
- **LLM processing**: research questions and retrieved web content are sent to the configured LLM provider (Google Gemini) to perform the research. Providers process this under their own terms; no account PII (email, name) is sent to the LLM — only the question text and retrieved sources.

## GDPR / CCPA obligations

For users in the EU or California:

- **Right to access / portability**: every report has an in-app export (cited Markdown). Account data is retrievable on request.
- **Right to deletion**: `Settings → Delete account` erases all research data (one cascading delete) and the Clerk identity in the same flow — see below.
- **Data minimization**: we store the minimum needed (Clerk ID + email + the user's own research); PII is concentrated in Clerk, not spread across our tables.
- **Retention & purpose limitation**: each data point above has a stated purpose and retention; nothing is kept beyond account deletion.
- **Lawful basis**: performance of the service the user requested (research) and legitimate interest (rate limiting / abuse protection).

## Deletion mechanism (implemented, not just documented)

`DELETE /api/account` (gateway) removes the `users` row; `ON DELETE CASCADE` on every child table (`runs` → `claims`, `sources`, `claim_sources`, `contradictions`, `run_evaluations`, `run_agents`, `trace_events`) erases all owned data in a single transaction. The client then calls Clerk's `user.delete()` to remove the authentication identity. Deletion is **immediate**, not a scheduled job.

To verify: after deletion, `SELECT count(*) FROM runs WHERE user_id = <id>` returns 0 and the Clerk user no longer exists.

## Sub-processors

| Processor | Role | Data received |
|---|---|---|
| Clerk | Authentication & identity | Email, name, credentials |
| Neon | Database hosting | All application data (encrypted at rest by the platform) |
| Google (Gemini) | LLM research | Research questions and retrieved web content |
| Vercel | Web app hosting | Request metadata for the frontend |
