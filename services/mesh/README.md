# Mesh (Python)

The agent runtime. As of Milestone 2 it runs the **single-agent research flow**:

1. Consumes `run.requested` from RabbitMQ ([contract](../../packages/contracts/messages))
2. Claims the run (`queued → running`, scoped by `user_id`)
3. Grounded search via Gemini (search-capable model) → answer + real sources
4. Claim extraction (structured output): each claim gets a confidence and its citations
5. Persists summary, claims, sources, and claim↔source links to Neon in one transaction
6. Marks the run `completed` (or `failed`, dead-lettering the message)

LLM routing (cheap search model vs. stronger synthesis model), retry-with-backoff, and
prompt-injection-safe handling of retrieved web content are in place; the multi-agent mesh,
contradiction detection, and credibility ranking arrive in Milestone 3.

## Run

Requires RabbitMQ (see [`infra/docker-compose.yml`](../../infra/docker-compose.yml) or a local
broker) and env vars `DATABASE_URL`, `RABBITMQ_URL`, `GEMINI_API_KEY`:

```bash
uv sync
uv run python -m mesh.worker
```

Optional overrides: `MESH_SEARCH_MODEL`, `MESH_SYNTHESIS_MODEL` (defaults documented in
[`config.py`](src/mesh/config.py)).

## Test

```bash
uv run ruff check
uv run pytest
```

Tests cover message-contract validation (kept in sync with `packages/contracts`), the
researcher's source/claim mapping (including dropping hallucinated citations and downgrading
unsourced claims), and worker dispatch (success, unclaimable run, failure → mark-failed,
invalid-message → dead-letter). They use fakes — no broker, database, or LLM calls.

## Layout

| Module | Responsibility |
|---|---|
| `worker.py` | RabbitMQ consumer, ack/reject + dead-letter policy, run lifecycle |
| `researcher.py` | Single-agent flow: grounded answer → validated claims + sources |
| `llm.py` | Gemini client, model router, retry/backoff, structured claim schema |
| `repo.py` | Postgres persistence, all statements scoped by `user_id` |
| `schemas.py` | Pydantic models mirroring the message + result contracts |
| `config.py` | Environment configuration |
