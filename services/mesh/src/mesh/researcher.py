"""Single-agent research flow (Milestone 2). The multi-agent mesh builds on this."""

import logging
from typing import Protocol

from mesh.llm import ClaimExtraction, GroundedAnswer
from mesh.schemas import Claim, ResearchResult, Source

log = logging.getLogger(__name__)


class ResearchLlm(Protocol):
    async def grounded_answer(self, question: str) -> GroundedAnswer: ...
    async def extract_claims(
        self, question: str, answer: str, sources: list[tuple[str, str | None]]
    ) -> ClaimExtraction: ...


class Researcher:
    def __init__(self, llm: ResearchLlm):
        self._llm = llm

    async def research(self, question: str) -> ResearchResult:
        grounded = await self._llm.grounded_answer(question)
        log.info("grounded answer ready: %d chars, %d sources",
                 len(grounded.text), len(grounded.sources))

        extraction = await self._llm.extract_claims(question, grounded.text, grounded.sources)

        sources = [
            Source(position=i + 1, url=url, title=title)
            for i, (url, title) in enumerate(grounded.sources)
        ]
        valid_positions = {s.position for s in sources}

        claims = []
        for i, draft in enumerate(extraction.claims):
            cited = sorted({n for n in draft.source_numbers if n in valid_positions})
            # A claim citing nothing we actually retrieved can't be trusted as sourced
            confidence = draft.confidence if cited else "low"
            claims.append(
                Claim(
                    position=i + 1,
                    text=draft.text.strip(),
                    confidence=confidence,
                    source_positions=cited,
                )
            )

        return ResearchResult(summary=extraction.summary.strip(), claims=claims, sources=sources)
