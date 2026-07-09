# Testing strategy

Consilience is tested at four levels. Unit and contract tests run in CI on every push and PR (the regression gate); end-to-end and load harnesses are scripted here for local runs because they need the full stack and a live LLM key.

## Unit tests (CI)

Per-service, fast, no external dependencies (fakes for broker/DB/LLM):

| Service | Runner | Covers |
|---|---|---|
| `apps/web` | `npm run lint && npm run build` | type-safety and lint gate |
| `services/gateway` | `dotnet test` (26) | auth middleware, run/approval endpoints, ownership, rate limit, security headers |
| `services/mesh` | `uv run pytest` (42) | researcher, orchestrator, credibility, evaluation, contradictions, worker, tracer |
| `services/engine` | `./gradlew test` | retry/backoff, rate-limit + approval policy |

## Contract tests (CI)

Boundary tests that keep the polyglot services in agreement without a running broker — each service asserts it reads/writes exactly the shape in [`packages/contracts`](../packages/contracts):

- Gateway [`ContractTests`](../services/gateway/tests/Consilience.Gateway.Tests/ContractTests.cs): the `run.requested` it produces and the `trace.event` it consumes.
- Engine [`RunRequestedContractTest`](../services/engine/src/test/java/com/consilience/engine/RunRequestedContractTest.java): deserializes the gateway's canonical payload.
- Mesh [`test_schemas`](../services/mesh/tests/test_schemas.py) and [`test_trace_contract`](../services/mesh/tests/test_trace_contract.py): validates consumed and emitted messages against the JSON Schemas.

If a message shape changes on one side without the other, one of these fails in CI.

## End-to-end (local)

[`e2e/pipeline_smoke.py`](e2e/pipeline_smoke.py) drives the critical flow — seed a run, publish `run.requested`, poll until terminal — and asserts the mesh produced agents, claims, and evaluations.

```bash
# Requires: RabbitMQ up, engine + mesh running, GEMINI_API_KEY set
uv run --project services/mesh python tests/e2e/pipeline_smoke.py
```

Verified manually during development: gateway → engine → mesh → `completed` in ~29s (3 agents, 26 claims, evaluations scored).

## Load (local)

[`load/dispatch_load.py`](load/dispatch_load.py) publishes N runs and measures how fast the engine drains them to a decision. With a low `ENGINE_MAX_RUNS_PER_HOUR`, most runs are rate-limited — exercising the engine's consume + policy + DB path at speed without spending LLM quota.

```bash
N=50 ENGINE_MAX_RUNS_PER_HOUR=1 uv run --project services/mesh python tests/load/dispatch_load.py
```

## Chaos / graceful degradation

The system is designed to degrade rather than cascade; these behaviors are covered by unit tests and reproducible by hand:

- **An agent fails mid-run** → the run completes on the survivors (orchestrator tests; observed live under LLM quota exhaustion, where all agents failed → the run was marked `failed` and its message dead-lettered).
- **The broker is unavailable** → durable queues + automatic consumer reconnect; the gateway trace relay retries its connection on startup.
- **A worker crashes mid-run** → the message redelivers and the mesh re-claims a `running` run rather than stranding it.
- **The gateway is unreachable** → the web app runs in web-only mode.

To reproduce the worker-crash case: start a run, kill the mesh worker before it completes, restart it — the redelivered message resumes the run.
