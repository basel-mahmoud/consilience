from mesh.evaluation import evaluate
from mesh.schemas import AgentResult, Claim, Contradiction, ResearchResult, Source


def agent(key: str, claims: list[Claim], sources: list[Source]) -> AgentResult:
    return AgentResult(
        lens_key=key,
        lens_label=key.title(),
        result=ResearchResult(summary="s", claims=claims, sources=sources),
    )


def scores(evals) -> dict[str, float]:
    return {e.metric: e.score for e in evals}


def test_grounding_counts_claims_with_sources():
    a = agent(
        "a",
        claims=[
            Claim(position=1, text="x", confidence="high", source_positions=[1]),
            Claim(position=2, text="y", confidence="high", source_positions=[]),
        ],
        sources=[Source(position=1, url="https://a.gov", credibility="high")],
    )
    assert scores(evaluate([a], []))["grounding"] == 0.5


def test_source_quality_is_credibility_weighted():
    a = agent(
        "a",
        claims=[Claim(position=1, text="x", confidence="high", source_positions=[1])],
        sources=[
            Source(position=1, url="https://a.gov", credibility="high"),
            Source(position=2, url="https://b.com", credibility="low"),
        ],
    )
    # (1.0 + 0.2) / 2 = 0.6
    assert scores(evaluate([a], []))["source_quality"] == 0.6


def test_consistency_drops_with_contradictions():
    a = agent(
        "a",
        claims=[
            Claim(position=i, text=str(i), confidence="high", source_positions=[1])
            for i in range(1, 5)
        ],
        sources=[Source(position=1, url="https://a.gov", credibility="high")],
    )
    # 2 of 4 claims flagged → consistency 0.5
    contradictions = [Contradiction(claim_a=0, claim_b=1, explanation="conflict")]
    assert scores(evaluate([a], contradictions))["consistency"] == 0.5


def test_corroboration_is_share_of_contributing_agents():
    a = agent("a", claims=[Claim(position=1, text="x", confidence="high", source_positions=[])],
              sources=[])
    b = agent("b", claims=[], sources=[])  # contributed nothing
    assert scores(evaluate([a, b], []))["corroboration"] == 0.5


def test_empty_run_does_not_divide_by_zero():
    result = scores(evaluate([], []))
    assert result["grounding"] == 0.0
    assert result["consistency"] == 1.0  # no claims → vacuously consistent
    assert result["corroboration"] == 0.0
