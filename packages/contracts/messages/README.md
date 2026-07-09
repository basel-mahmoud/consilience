# Broker topology & message schemas

Exchange: **`consilience`** (topic, durable). Dead letters go to **`consilience.dlx`** → `<queue>.dlq`.

| Routing key | Schema | Producer → Consumer | Queue |
|---|---|---|---|
| `run.requested` | [research-run-requested.v1](research-run-requested.v1.json) | gateway → engine | `engine.run-requests` |
| `agent.dispatch` | [research-run-requested.v1](research-run-requested.v1.json) | engine → mesh | `mesh.run-requests` |

The engine relays the same payload on `agent.dispatch` after its rate-limit and approval-gate
checks pass — the mesh only ever researches runs the engine has cleared.

Rules:

- Messages are persistent JSON (`content_type: application/json`); consumers ack only after their DB writes commit.
- Consumers validate against the schema before acting; invalid messages are rejected (no requeue) and land in the DLQ.
- Schema changes are versioned (`.v2` alongside `.v1`), never mutated in place.
- Retry/backoff orchestration arrives with the engine (Milestone 4); until then a failed run is marked `failed` and its message dead-lettered.
