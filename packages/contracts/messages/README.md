# Broker topology & message schemas

Exchange: **`consilience`** (topic, durable). Dead letters go to **`consilience.dlx`** → `<queue>.dlq`.

| Routing key | Schema | Producer → Consumer | Queue |
|---|---|---|---|
| `run.requested` | [research-run-requested.v1](research-run-requested.v1.json) | gateway → mesh | `mesh.run-requests` |

Rules:

- Messages are persistent JSON (`content_type: application/json`); consumers ack only after their DB writes commit.
- Consumers validate against the schema before acting; invalid messages are rejected (no requeue) and land in the DLQ.
- Schema changes are versioned (`.v2` alongside `.v1`), never mutated in place.
- Retry/backoff orchestration arrives with the engine (Milestone 4); until then a failed run is marked `failed` and its message dead-lettered.
