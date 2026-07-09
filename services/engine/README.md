# Engine (Java)

The workflow/event execution engine. It sits **in front of the mesh**: the gateway publishes
`run.requested`, the engine applies policy, and only cleared runs reach the mesh on
`agent.dispatch` ([contracts](../../packages/contracts/messages)).

As of Milestone 4a it owns:

- **Queue consumer** for `run.requested` (durable queue `engine.run-requests`, dead-letter exchange)
- **Per-user rate limiting**: a sliding one-hour window (default 10 runs/user/hour); runs over the
  cap are marked `rate_limited` and never dispatched — protecting against runaway LLM cost
- **Dispatch to the mesh** on `agent.dispatch` with publisher confirms and **retry/backoff**;
  a dispatch that ultimately fails marks the run `failed` and dead-letters the message
- Invalid messages are dead-lettered, never silently dropped

The human-in-the-loop **approval gate** and its rules engine arrive in Milestone 4b.

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
| `Main` | RabbitMQ consumer wiring, ack/reject + dead-letter policy |
| `RunProcessor` | Policy decision: rate-limit or dispatch (unit-tested with fakes) |
| `RateLimiter`-style logic | Enforced in `RunProcessor` via `Runs.countRunsInLastHour` |
| `Retry` | Exponential backoff for idempotent external calls |
| `RabbitDispatcher` | Publishes `agent.dispatch` with confirms + retry |
| `PostgresRuns` | JDBC run-state access, scoped by `user_id` |
| `Config` | Environment configuration |
