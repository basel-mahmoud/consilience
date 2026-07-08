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


class Claim(BaseModel):
    position: int
    text: str
    confidence: Confidence
    source_positions: list[int]


class ResearchResult(BaseModel):
    summary: str
    claims: list[Claim]
    sources: list[Source]
