#!/usr/bin/env python3
"""Load test for the engine's dispatch path.

Publishes N run.requested messages and measures how quickly the engine drains them
to a decision (dispatched / rate_limited). Set ENGINE_MAX_RUNS_PER_HOUR low so most
runs are rate-limited — that exercises the engine's consume + policy + DB-write path
at speed without spending LLM quota. A full orchestration load test (letting runs
reach the mesh) additionally needs a live GEMINI_API_KEY and headroom in its quota.

Run: N=50 uv run --project services/mesh python tests/load/dispatch_load.py
"""

import asyncio
import json
import os
import sys
import time
from datetime import UTC, datetime
from uuid import uuid4

import aio_pika
import asyncpg

N = int(os.environ.get("N", "50"))


async def main() -> int:
    dsn = os.environ["DATABASE_URL"].split("?", 1)[0]
    pool = await asyncpg.create_pool(dsn, ssl="require", min_size=1, max_size=4)
    user_id = await pool.fetchval("SELECT id FROM users ORDER BY created_at LIMIT 1")
    if user_id is None:
        print("FAIL: no users exist")
        return 1

    run_ids = [uuid4() for _ in range(N)]
    await pool.executemany(
        "INSERT INTO runs (id, user_id, question) VALUES ($1, $2, $3)",
        [(rid, user_id, f"Load test question {i}") for i, rid in enumerate(run_ids)],
    )

    conn = await aio_pika.connect_robust(os.environ["RABBITMQ_URL"])
    channel = await conn.channel()
    exchange = await channel.declare_exchange(
        "consilience", aio_pika.ExchangeType.TOPIC, durable=True
    )

    start = time.monotonic()
    for rid in run_ids:
        await exchange.publish(
            aio_pika.Message(
                body=json.dumps({
                    "runId": str(rid), "userId": str(user_id),
                    "question": "Load test question", "requestedAt": datetime.now(UTC).isoformat(),
                }).encode(),
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key="run.requested",
        )
    await conn.close()
    print(f"published {N} runs in {time.monotonic() - start:.2f}s; draining…")

    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        pending = await pool.fetchval(
            "SELECT count(*) FROM runs WHERE id = ANY($1) AND status = 'queued'", run_ids
        )
        if pending == 0:
            break
        await asyncio.sleep(1)

    elapsed = time.monotonic() - start
    decided = await pool.fetchval(
        "SELECT count(*) FROM runs WHERE id = ANY($1) AND status <> 'queued'", run_ids
    )
    await pool.execute("DELETE FROM runs WHERE id = ANY($1)", run_ids)
    await pool.close()

    print(f"decided {decided}/{N} runs in {elapsed:.2f}s "
          f"({decided / elapsed:.1f} runs/s through the engine)")
    return 0 if decided == N else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
