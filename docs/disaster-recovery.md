# Disaster recovery & rollback

Modest, explicit targets appropriate to a portfolio deployment — the point is a documented, rehearsed plan, not five-nines infrastructure.

## Objectives

| Target | Value | Rationale |
|---|---|---|
| **RPO** (max data loss) | ≤ 24h | Neon's daily automated backups + point-in-time restore within the retention window |
| **RTO** (max downtime) | ≤ 1h | Stateless services redeploy in minutes; the recovery steps below are scripted, not investigative |

## What can fail, and the response

### Web app (Vercel)
- **Symptom:** 5xx or a bad deploy.
- **Recovery:** Vercel keeps every prior deployment. Instant rollback via the dashboard (Promote a previous deployment) or by reverting the commit and pushing — the git integration redeploys. RTO: minutes.

### Gateway / engine / mesh
- **Symptom:** a service is down or crash-looping.
- **Recovery:** all three are stateless (state lives in Postgres and the broker). Restart, or redeploy the previous container tag. In-flight runs are safe: unacked broker messages redeliver, and the mesh re-claims a `running` run on redelivery rather than stranding it. RTO: minutes.

### Database (Neon Postgres)
- **Symptom:** data corruption or accidental loss.
- **Recovery:** Neon point-in-time restore to just before the incident (RPO ≤ 24h). Schema is reproducible from the versioned migrations under `services/*/migrations`. After restore, verify with a read of `runs`/`users` counts.
- **Branching:** Neon branches give a disposable copy for testing a restore before promoting it.

### Message broker (RabbitMQ)
- **Symptom:** broker down.
- **Recovery:** queues and messages are durable (persistent delivery mode). Restart the broker; consumers reconnect automatically (the gateway trace relay retries the connection, and aio-pika/RabbitMQ clients reconnect). A total broker loss drops only in-flight, unacked trace events (cosmetic); run state in Postgres is unaffected.

## Rollback plan

1. Identify the last-good commit (`git log`, CI status, CHANGELOG).
2. Frontend: Vercel instant rollback, or `git revert <bad-sha> && git push`.
3. Backend: redeploy the previous tag; no rollback needed for additive DB migrations. **Migrations are forward-only and additive** (new tables/columns, widened CHECK constraints) — a reverted service keeps working against the newer schema, so a code rollback never requires a DB rollback.
4. Verify: `/health` on the gateway, a signed-in dashboard load, and a run list read.

## Backups

- **Database:** Neon automated daily backups + PITR (platform-managed).
- **Code & schema:** GitHub is the source of truth; migrations are committed alongside the code that uses them.
- **Secrets:** stored in the host's environment/secret manager and the owner's password manager — not in the repo, and therefore restored independently of a code or data recovery.
