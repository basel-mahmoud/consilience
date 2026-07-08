"""Multi-agent orchestration (Milestone 3a).

Fans out one research agent per lens, runs them concurrently, and synthesizes a
run-level answer across their findings. Partial failure is tolerated: if some
agents fail, the run still completes on the survivors; only a total wipeout fails.
"""

import asyncio
import logging
from typing import Protocol

from mesh.lenses import Lens, default_lenses
from mesh.schemas import AgentResult, MeshResult, ResearchResult

log = logging.getLogger(__name__)


class Agent(Protocol):
    async def research(self, question: str, guidance: str | None = None) -> ResearchResult: ...


class Synthesizer(Protocol):
    async def synthesize(self, question: str, findings: list[tuple[str, str]]) -> str: ...


class Orchestrator:
    def __init__(
        self,
        agent: Agent,
        synthesizer: Synthesizer,
        lenses: tuple[Lens, ...] | None = None,
    ):
        self._agent = agent
        self._synthesizer = synthesizer
        self._lenses = lenses or default_lenses()

    async def run(self, question: str) -> MeshResult:
        results = await asyncio.gather(
            *(self._agent.research(question, lens.guidance) for lens in self._lenses),
            return_exceptions=True,
        )

        agents: list[AgentResult] = []
        for lens, result in zip(self._lenses, results, strict=True):
            if isinstance(result, BaseException):
                log.warning("agent '%s' failed: %s", lens.key, result)
                continue
            agents.append(
                AgentResult(lens_key=lens.key, lens_label=lens.label, result=result)
            )

        if not agents:
            raise RuntimeError("all research agents failed")

        summary = await self._summarize(question, agents)
        log.info("mesh run: %d/%d agents succeeded", len(agents), len(self._lenses))
        return MeshResult(summary=summary, agents=agents)

    async def _summarize(self, question: str, agents: list[AgentResult]) -> str:
        findings = [(a.lens_label, a.result.summary) for a in agents]
        try:
            return await self._synthesizer.synthesize(question, findings)
        except Exception:
            # Synthesis is a nicety, not the payload — never fail a run over it
            log.exception("cross-agent synthesis failed; falling back to first agent")
            return agents[0].result.summary
