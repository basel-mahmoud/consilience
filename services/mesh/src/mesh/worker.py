"""RabbitMQ consumer: takes ResearchRunRequested messages through the research flow."""

import asyncio
import json
import logging
from collections.abc import Callable
from typing import Protocol
from uuid import UUID

import aio_pika
from pydantic import ValidationError

from mesh.config import Config
from mesh.llm import GeminiClient, ModelRouter
from mesh.orchestrator import Orchestrator
from mesh.repo import RunRepository
from mesh.researcher import Researcher
from mesh.schemas import MeshResult, RunRequested
from mesh.trace import NullTracer, RabbitTracer, Tracer

TracerFactory = Callable[[UUID, UUID], Tracer]

log = logging.getLogger(__name__)

EXCHANGE = "consilience"
DLX = "consilience.dlx"
QUEUE = "mesh.run-requests"
# The engine (M4) sits in front of the mesh: it consumes run.requested from the
# gateway, applies rate limiting and approval policy, then dispatches here.
ROUTING_KEY = "agent.dispatch"


class InvalidMessage(Exception):
    """Message fails schema validation — reject to DLQ, never requeue."""


class RunStore(Protocol):
    async def claim_run(self, run_id: UUID, user_id: UUID) -> bool: ...
    async def save_mesh_result(self, run_id: UUID, user_id: UUID, mesh: MeshResult) -> None: ...
    async def mark_failed(self, run_id: UUID, user_id: UUID, error: str) -> None: ...


class Mesh(Protocol):
    async def run(self, question: str) -> MeshResult: ...


async def handle_message(
    body: bytes, repo: RunStore, mesh: Mesh, make_tracer: "TracerFactory | None" = None
) -> None:
    try:
        message = RunRequested.model_validate(json.loads(body))
    except (ValidationError, ValueError) as exc:
        raise InvalidMessage(str(exc)) from exc

    claimed = await repo.claim_run(message.run_id, message.user_id)
    if not claimed:
        # Already completed/failed (e.g. redelivery after a late ack) — idempotent skip
        log.warning("run %s not claimable, skipping", message.run_id)
        return

    tracer = make_tracer(message.run_id, message.user_id) if make_tracer else NullTracer()
    log.info("run %s started: %.60s…", message.run_id, message.question)
    await tracer.emit("run.started", "Dispatching research agents")
    try:
        result = await mesh.run(message.question, tracer)
        await repo.save_mesh_result(message.run_id, message.user_id, result)
    except Exception as exc:
        await repo.mark_failed(message.run_id, message.user_id, str(exc))
        await tracer.emit("run.failed", "The run failed before completing")
        raise
    total_claims = sum(len(a.result.claims) for a in result.agents)
    total_sources = sum(len(a.result.sources) for a in result.agents)
    await tracer.emit(
        "run.completed",
        f"Report ready: {total_claims} claims from {len(result.agents)} agents",
        {"claims": total_claims, "sources": total_sources,
         "contradictions": len(result.contradictions)},
    )
    log.info(
        "run %s completed: %d agents, %d claims, %d sources, %d contradictions",
        message.run_id, len(result.agents), total_claims, total_sources,
        len(result.contradictions),
    )


async def consume(config: Config) -> None:
    repo = await RunRepository.connect(config.database_url)
    llm = GeminiClient(config, ModelRouter(config))
    mesh = Orchestrator(agent=Researcher(llm), synthesizer=llm, finder=llm)

    connection = await aio_pika.connect_robust(config.rabbitmq_url)
    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=2)

        exchange = await channel.declare_exchange(
            EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True
        )
        dlx = await channel.declare_exchange(DLX, aio_pika.ExchangeType.TOPIC, durable=True)
        dlq = await channel.declare_queue(f"{QUEUE}.dlq", durable=True)
        await dlq.bind(dlx, routing_key="#")
        queue = await channel.declare_queue(
            QUEUE, durable=True, arguments={"x-dead-letter-exchange": DLX}
        )
        await queue.bind(EXCHANGE, routing_key=ROUTING_KEY)

        def make_tracer(run_id: UUID, user_id: UUID) -> Tracer:
            return RabbitTracer(exchange, run_id, user_id)

        log.info("mesh worker consuming %s (search=%s, synthesis=%s)",
                 QUEUE, config.search_model, config.synthesis_model)

        async with queue.iterator() as messages:
            async for message in messages:
                try:
                    await handle_message(message.body, repo, mesh, make_tracer)
                    await message.ack()
                except InvalidMessage:
                    log.exception("invalid message — dead-lettering")
                    await message.reject(requeue=False)
                except Exception:
                    # Run already marked failed; engine-driven retries arrive in M4
                    log.exception("run processing failed — dead-lettering")
                    await message.reject(requeue=False)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
    )
    asyncio.run(consume(Config.from_env()))


if __name__ == "__main__":
    main()
