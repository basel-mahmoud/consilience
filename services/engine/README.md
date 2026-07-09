# Engine (Java)

The workflow/event execution engine. It sits **in front of the mesh**: the gateway publishes
`run.requested`, the engine applies policy, and only cleared runs reach the mesh on
`agent.dispatch` ([contracts](../../packages/contracts/messages)).

It owns:

- **Queue consumer** for `run.requested` (durable queue `engine.run-requests`, dead-letter exchange)
- **Per-user rate limiting**: a sliding one-hour window (default 10 runs/user/hour); runs over the
  cap are marked `rate_limited` and never dispatched — protecting against runaway LLM cost
- **Approval-gate rules engine** (`ApprovalRules`): flags runs whose question touches a sensitive
  domain (medical, legal, financial, safety) as `awaiting_approval` and holds them until a human
  approves — the mesh presents confident, cited-looking claims, so those topics get a checkpoint
- **Dispatch to the mesh** on `agent.dispatch` with publisher confirms and **retry/backoff**;
  a dispatch that ultimately fails marks the run `failed` and dead-letters the message
- **Approval consumer** for `run.approved` (queue `engine.approvals`): dispatches a human-approved
  run without re-running the rules
- Invalid messages are dead-lettered, never silently dropped

Precedence per run: rate limit → approval gate → dispatch.

## Run

Requires the JDK 21 toolchain, RabbitMQ, and env vars `DATABASE_URL`, `RABBITMQ_URL`
(optional `ENGINE_MAX_RUNS_PER_HOUR`):

```bash
DATABASE_URL="postgresql://…" RABBITMQ_URL="amqp://guest:guest@localhost:5672" \
  ./gradlew run
```

## Test

```bash
./gradlew build   # compiles, checks formatting (spotless), runs tests
```

Tests cover the retry/backoff helper (success, retry-then-succeed, exhaustion, doubling delays)
and the run processor (dispatch under the cap, rate-limit over it, dispatch-failure propagation)
with fakes — no broker or database.

## Layout

| Class | Responsibility |
|---|---|
| `Main` | RabbitMQ consumer wiring (run-requests + approvals), ack/reject + dead-letter policy |
| `RunProcessor` | Policy decision: rate-limit → approval gate → dispatch (unit-tested with fakes) |
| `ApprovalRules` | Transparent keyword policy flagging sensitive-domain questions for review |
| `Retry` | Exponential backoff for idempotent external calls |
| `RabbitDispatcher` | Publishes `agent.dispatch` with confirms + retry |
| `PostgresRuns` | JDBC run-state access, scoped by `user_id` |
| `Config` | Environment configuration |
