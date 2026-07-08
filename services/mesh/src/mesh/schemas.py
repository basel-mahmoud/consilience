"""Pydantic models mirroring packages/contracts — the mesh's view of every boundary."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Confidence = Literal["high", "mid", "low"]


class RunRequested(BaseModel):
    """packages/contracts/messages/research-run-requested.v1.json"""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    run_id: UUID = Field(alias="runId")
    user_id: UUID = Field(alias="userId")
    question: str = Field(min_length=10, max_length=500)
    requested_at: datetime = Field(alias="requestedAt")


class Source(BaseModel):
    position: int
    url: str
    title: str | None = None
    credibility: Confidence | None = None
    credibility_rationale: str | None = None


class Claim(BaseModel):
    position: int
    text: str
    confidence: Confidence
    source_positions: list[int]


class ResearchResult(BaseModel):
    """Output of a single research agent (Milestone 2, and one lens in M3)."""

    summary: str
    claims: list[Claim]
    sources: list[Source]


class AgentResult(BaseModel):
    """One lens's contribution to a multi-agent run."""

    lens_key: str
    lens_label: str
    result: ResearchResult


class Contradiction(BaseModel):
    """A pair of claims that disagree, referenced by global claim index (0-based,
    in agent order — the same order the repository persists claims)."""

    claim_a: int
    claim_b: int
    explanation: str


class Evaluation(BaseModel):
    """One quality metric for a run, scored 0..1."""

    metric: str
    score: float = Field(ge=0.0, le=1.0)
    rationale: str


class MeshResult(BaseModel):
    """Aggregate of all agents in a run, plus cross-agent synthesis, the
    contradictions found between agents, and the run's evaluation scores."""

    summary: str
    agents: list[AgentResult]
    contradictions: list[Contradiction] = []
    evaluations: list[Evaluation] = []
