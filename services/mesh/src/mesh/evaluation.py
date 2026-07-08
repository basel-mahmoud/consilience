"""Deterministic evaluation harness — scores a run's output quality 0..1.

No LLM: these are transparent, reproducible metrics over what the mesh produced.
They give every run an at-a-glance quality read and a regression signal as the
agent logic evolves.
"""

from mesh.schemas import AgentResult, Contradiction, Evaluation

_CREDIBILITY_WEIGHT = {"high": 1.0, "mid": 0.6, "low": 0.2}


def evaluate(
    agents: list[AgentResult], contradictions: list[Contradiction]
) -> list[Evaluation]:
    claims = [c for a in agents for c in a.result.claims]
    sources = [s for a in agents for s in a.result.sources]
    n_claims = len(claims)

    # Grounding: share of claims backed by at least one cited source.
    grounded = sum(1 for c in claims if c.source_positions)
    grounding = grounded / n_claims if n_claims else 0.0

    # Source quality: credibility-weighted mean across all sources.
    if sources:
        source_quality = sum(
            _CREDIBILITY_WEIGHT.get(s.credibility or "low", 0.2) for s in sources
        ) / len(sources)
    else:
        source_quality = 0.0

    # Consistency: 1 minus the share of claims caught in a contradiction.
    contradicted = {i for c in contradictions for i in (c.claim_a, c.claim_b)}
    consistency = 1.0 - (len(contradicted) / n_claims) if n_claims else 1.0

    # Corroboration: share of agents that contributed at least one claim — the
    # breadth of independent vantage points behind the report.
    contributing = sum(1 for a in agents if a.result.claims)
    corroboration = contributing / len(agents) if agents else 0.0

    return [
        Evaluation(
            metric="grounding",
            score=round(grounding, 3),
            rationale=f"{grounded} of {n_claims} claims cite at least one source.",
        ),
        Evaluation(
            metric="source_quality",
            score=round(source_quality, 3),
            rationale=f"Credibility-weighted mean across {len(sources)} sources.",
        ),
        Evaluation(
            metric="consistency",
            score=round(consistency, 3),
            rationale=(
                f"{len(contradicted)} of {n_claims} claims are involved in a "
                f"cross-agent contradiction."
            ),
        ),
        Evaluation(
            metric="corroboration",
            score=round(corroboration, 3),
            rationale=f"{contributing} of {len(agents)} agents contributed claims.",
        ),
    ]
