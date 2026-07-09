#!/usr/bin/env python3
"""End-to-end smoke test for the critical flow: gateway → engine → mesh → report.

Seeds a run, publishes it on `run.requested`, and polls until it reaches a terminal
state — asserting the mesh produced agents, claims, and evaluations. Requires the
engine and mesh running, RabbitMQ up, and a live GEMINI_API_KEY (see tests/README.md).

Run: uv run --project services/mesh python tests/e2e/pipeline_smoke.py
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

QUESTION = "What are the documented health benefits of regular moderate exercise?"
TERMINAL = {"completed", "failed", "rate_limited", "awaiting_approval", "rejected"}


def _dsn() -> str:
    url = os.environ["DATABASE_URL"]
    return url.split("?", 1)[0]


async def main() -> int:
    pool = await asyncpg.create_pool(_dsn(), ssl="require", min_size=1, max_size=2)
    user_id = await pool.fetchval("SELECT id FROM users ORDER BY created_at LIMIT 1")
    if user_id is None:
        print("FAIL: no users exist — sign in once first")
        return 1

    run_id = uuid4()
    await pool.execute(
        "INSERT INTO runs (id, user_id, question) VALUES ($1, $2, $3)",
        run_id, user_id, QUESTION,
    )

    conn = await aio_pika.connect_robust(os.environ["RABBITMQ_URL"])
    channel = await conn.channel()
    exchange = await channel.declare_exchange(
        "consilience", aio_pika.ExchangeType.TOPIC, durable=True
    )
    await exchange.publish(
        aio_pika.Message(
            body=json.dumps({
                "runId": str(run_id), "userId": str(user_id),
                "question": QUESTION, "requestedAt": datetime.now(UTC).isoformat(),
            }).encode(),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        ),
        routing_key="run.requested",
    )
    await conn.close()
    print(f"published run {run_id}; waiting for completion…")

    deadline = time.monotonic() + 180
    status = "queued"
    while time.monotonic() < deadline:
        status = await pool.fetchval("SELECT status FROM runs WHERE id = $1", run_id)
        if status in TERMINAL:
            break
        await asyncio.sleep(2)

    agents = await pool.fetchval("SELECT count(*) FROM run_agents WHERE run_id = $1", run_id)
    claims = await pool.fetchval("SELECT count(*) FROM claims WHERE run_id = $1", run_id)
    evals = await pool.fetchval("SELECT count(*) FROM run_evaluations WHERE run_id = $1", run_id)
    await pool.close()

    print(f"status={status} agents={agents} claims={claims} evaluations={evals}")
    if status == "completed" and agents > 0 and claims > 0 and evals == 4:
        print("PASS: critical flow completed end to end")
        return 0
    print("FAIL: run did not complete as expected")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
