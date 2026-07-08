# Mesh (Python)

The agent runtime. As of Milestone 3b it runs the **multi-agent mesh with cross-checking**:

1. Consumes `run.requested` from RabbitMQ ([contract](../../packages/contracts/messages))
2. Claims the run (`queued → running`, scoped by `user_id`)
3. Fans out one agent per **lens** (primary evidence, expert analysis, skeptical review),
   running them concurrently — each does its own grounded Gemini search and claim extraction
4. Scores every source's **credibility** (`high`/`mid`/`low`) by domain class
5. Detects **contradictions** across the agents' claims and downgrades the confidence of any
   claim caught in one (high→mid→low)
6. Synthesizes a run-level answer and scores the run with the **evaluation harness**
   (grounding, source quality, consistency, corroboration)
7. Persists agents, attributed + credibility-scored sources, claims, contradictions, and
   evaluations in one transaction; marks the run `completed` (or `failed`, dead-lettering)

Partial failure is tolerated end to end: if some agents fail the run completes on the
survivors, and contradiction/synthesis failures are non-fatal. LLM model routing,
retry-with-backoff, and prompt-injection-safe handling of retrieved web content are in place.

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
| `orchestrator.py` | Fans out agents per lens in parallel, tolerates partial failure, synthesizes |
| `researcher.py` | One agent: grounded answer → credibility-scored sources + validated claims |
| `lenses.py` | The distinct research angles each parallel agent takes |
| `credibility.py` | Deterministic source-credibility scoring by domain class |
| `evaluation.py` | Deterministic run-quality metrics (grounding, source quality, consistency, corroboration) |
| `llm.py` | Gemini client, model router, retry/backoff, structured claim/synthesis/contradiction |
| `repo.py` | Postgres persistence, all statements scoped by `user_id` |
| `schemas.py` | Pydantic models mirroring the message + result contracts |
| `config.py` | Environment configuration |
