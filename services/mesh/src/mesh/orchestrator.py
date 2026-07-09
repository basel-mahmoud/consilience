"""Multi-agent orchestration.

M3a: fans out one research agent per lens, concurrently, and synthesizes a
run-level answer. M3b: detects contradictions across the agents' claims,
downgrades the confidence of claims caught in a contradiction, and scores the
run with the evaluation harness. Partial failure is tolerated: if some agents
fail the run completes on the survivors; only a total wipeout fails.
"""

import asyncio
import logging
from typing import Protocol

from mesh.evaluation import evaluate
from mesh.lenses import Lens, default_lenses
from mesh.schemas import (
    AgentResult,
    Claim,
    Confidence,
    Contradiction,
    MeshResult,
    ResearchResult,
)
from mesh.trace import NullTracer, Tracer

log = logging.getLogger(__name__)

_DOWNGRADE: dict[Confidence, Confidence] = {"high": "mid", "mid": "low", "low": "low"}


class Agent(Protocol):
    async def research(self, question: str, guidance: str | None = None) -> ResearchResult: ...


class Synthesizer(Protocol):
    async def synthesize(self, question: str, findings: list[tuple[str, str]]) -> str: ...


class ContradictionFinder(Protocol):
    async def detect_contradictions(
        self, question: str, claims: list[str]
    ) -> list[tuple[int, int, str]]: ...


class Orchestrator:
    def __init__(
        self,
        agent: Agent,
        synthesizer: Synthesizer,
        finder: ContradictionFinder,
        lenses: tuple[Lens, ...] | None = None,
    ):
        self._agent = agent
        self._synthesizer = synthesizer
        self._finder = finder
        self._lenses = lenses or default_lenses()

    async def run(self, question: str, tracer: Tracer | None = None) -> MeshResult:
        tracer = tracer or NullTracer()
        results = await asyncio.gather(
            *(self._run_agent(question, lens, tracer) for lens in self._lenses),
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
        await tracer.emit("synthesis", "Synthesized findings across agents")

        contradictions = await self._find_contradictions(question, agents)
        if contradictions:
            agents = _downgrade_contradicted(agents, contradictions)
        await tracer.emit(
            "contradictions",
            f"Found {len(contradictions)} contradiction(s) across agents",
            {"count": len(contradictions)},
        )
        evaluations = evaluate(agents, contradictions)

        log.info(
            "mesh run: %d/%d agents, %d contradictions",
            len(agents), len(self._lenses), len(contradictions),
        )
        return MeshResult(
            summary=summary,
            agents=agents,
            contradictions=contradictions,
            evaluations=evaluations,
        )

    async def _run_agent(self, question: str, lens: Lens, tracer: Tracer) -> ResearchResult:
        await tracer.emit(
            "agent.started", f"{lens.label} agent researching", {"lens": lens.key}
        )
        result = await self._agent.research(question, lens.guidance)
        await tracer.emit(
            "agent.completed",
            f"{lens.label}: {len(result.claims)} claims, {len(result.sources)} sources",
            {"lens": lens.key, "claims": len(result.claims), "sources": len(result.sources)},
        )
        return result

    async def _summarize(self, question: str, agents: list[AgentResult]) -> str:
        findings = [(a.lens_label, a.result.summary) for a in agents]
        try:
            return await self._synthesizer.synthesize(question, findings)
        except Exception:
            # Synthesis is a nicety, not the payload — never fail a run over it
            log.exception("cross-agent synthesis failed; falling back to first agent")
            return agents[0].result.summary

    async def _find_contradictions(
        self, question: str, agents: list[AgentResult]
    ) -> list[Contradiction]:
        claim_texts = [c.text for c in _flat_claims(agents)]
        try:
            pairs = await self._finder.detect_contradictions(question, claim_texts)
        except Exception:
            # Contradiction detection is additive signal; a failure shouldn't sink the run
            log.exception("contradiction detection failed; continuing without it")
            return []
        return [Contradiction(claim_a=a, claim_b=b, explanation=e) for a, b, e in pairs]


def _flat_claims(agents: list[AgentResult]) -> list[Claim]:
    """Claims across all agents in persistence order (agent order, then position)."""
    return [claim for agent in agents for claim in agent.result.claims]


def _downgrade_contradicted(
    agents: list[AgentResult], contradictions: list[Contradiction]
) -> list[AgentResult]:
    """Lower the confidence of every claim caught in a contradiction by one level."""
    flagged = {i for c in contradictions for i in (c.claim_a, c.claim_b)}
    updated: list[AgentResult] = []
    index = 0
    for agent in agents:
        claims = []
        for claim in agent.result.claims:
            if index in flagged:
                claim = claim.model_copy(update={"confidence": _DOWNGRADE[claim.confidence]})
            claims.append(claim)
            index += 1
        updated.append(
            agent.model_copy(update={"result": agent.result.model_copy(update={"claims": claims})})
        )
    return updated
