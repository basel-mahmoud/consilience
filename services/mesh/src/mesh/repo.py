"""Postgres persistence. Every statement is scoped by user_id — never trust run_id alone."""

import logging
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID

import asyncpg

from mesh.schemas import MeshResult

log = logging.getLogger(__name__)


def _clean_dsn(database_url: str) -> str:
    # Neon URLs carry query params asyncpg doesn't accept; TLS is passed explicitly
    parts = urlsplit(database_url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


class RunRepository:
    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    @classmethod
    async def connect(cls, database_url: str) -> "RunRepository":
        pool = await asyncpg.create_pool(
            _clean_dsn(database_url), ssl="require", min_size=1, max_size=5
        )
        return cls(pool)

    async def close(self) -> None:
        await self._pool.close()

    async def claim_run(self, run_id: UUID, user_id: UUID) -> bool:
        """Transition queued→running. Also re-claims 'running' so a redelivered
        message after a worker crash restarts the run instead of stranding it."""
        result = await self._pool.execute(
            """
            UPDATE runs SET status = 'running', started_at = COALESCE(started_at, now())
            WHERE id = $1 AND user_id = $2 AND status IN ('queued', 'running')
            """,
            run_id,
            user_id,
        )
        return result == "UPDATE 1"

    async def save_mesh_result(self, run_id: UUID, user_id: UUID, mesh: MeshResult) -> None:
        """Persist all agents, their credibility-scored sources, and attributed
        claims in one transaction. Source and claim positions are numbered
        globally across agents so the run-level lists render in a stable order."""
        async with self._pool.acquire() as conn, conn.transaction():
            updated = await conn.execute(
                """
                UPDATE runs SET status = 'completed', summary = $3, completed_at = now()
                WHERE id = $1 AND user_id = $2 AND status = 'running'
                """,
                run_id,
                user_id,
                mesh.summary,
            )
            if updated != "UPDATE 1":
                raise RuntimeError(f"run {run_id} not in running state for user {user_id}")

            source_position = 0
            claim_position = 0
            for agent in mesh.agents:
                agent_id = await conn.fetchval(
                    "INSERT INTO run_agents (run_id, lens, status, completed_at)"
                    " VALUES ($1, $2, 'completed', now()) RETURNING id",
                    run_id,
                    agent.lens_label,
                )

                # Map this agent's local source positions to the inserted rows
                local_source_ids: dict[int, UUID] = {}
                for source in agent.result.sources:
                    source_position += 1
                    local_source_ids[source.position] = await conn.fetchval(
                        "INSERT INTO sources"
                        " (run_id, run_agent_id, position, url, title, credibility,"
                        "  credibility_rationale)"
                        " VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
                        run_id,
                        agent_id,
                        source_position,
                        source.url,
                        source.title,
                        source.credibility,
                        source.credibility_rationale,
                    )

                for claim in agent.result.claims:
                    claim_position += 1
                    claim_id = await conn.fetchval(
                        "INSERT INTO claims (run_id, run_agent_id, position, text, confidence)"
                        " VALUES ($1, $2, $3, $4, $5) RETURNING id",
                        run_id,
                        agent_id,
                        claim_position,
                        claim.text,
                        claim.confidence,
                    )
                    for position in claim.source_positions:
                        await conn.execute(
                            "INSERT INTO claim_sources (claim_id, source_id) VALUES ($1, $2)",
                            claim_id,
                            local_source_ids[position],
                        )

    async def mark_failed(self, run_id: UUID, user_id: UUID, error: str) -> None:
        await self._pool.execute(
            """
            UPDATE runs SET status = 'failed', error = left($3, 500), completed_at = now()
            WHERE id = $1 AND user_id = $2 AND status IN ('queued', 'running')
            """,
            run_id,
            user_id,
            error,
        )

    async def status(self, run_id: UUID, user_id: UUID) -> str | None:
        return await self._pool.fetchval(
            "SELECT status FROM runs WHERE id = $1 AND user_id = $2", run_id, user_id
        )
