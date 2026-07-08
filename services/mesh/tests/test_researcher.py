from mesh.llm import ClaimDraft, ClaimExtraction, GroundedAnswer
from mesh.researcher import Researcher


class FakeLlm:
    def __init__(self, grounded: GroundedAnswer, extraction: ClaimExtraction):
        self._grounded = grounded
        self._extraction = extraction
        self.extract_args: tuple | None = None

    async def grounded_answer(self, question: str) -> GroundedAnswer:
        return self._grounded

    async def extract_claims(self, question, answer, sources) -> ClaimExtraction:
        self.extract_args = (question, answer, sources)
        return self._extraction


GROUNDED = GroundedAnswer(
    text="Detailed answer text.",
    sources=[("https://a.example/x", "Source A"), ("https://b.example/y", None)],
)


async def test_maps_sources_and_claims_with_positions():
    extraction = ClaimExtraction(
        summary="  A summary.  ",
        claims=[
            ClaimDraft(text=" First claim. ", confidence="high", source_numbers=[1, 2]),
            ClaimDraft(text="Second claim.", confidence="mid", source_numbers=[2]),
        ],
    )
    result = await Researcher(FakeLlm(GROUNDED, extraction)).research("q" * 20)

    assert [s.position for s in result.sources] == [1, 2]
    assert result.sources[0].url == "https://a.example/x"
    assert result.summary == "A summary."
    assert result.claims[0].text == "First claim."
    assert result.claims[0].source_positions == [1, 2]
    assert result.claims[1].position == 2


async def test_invalid_source_numbers_are_dropped_and_unsourced_claims_downgraded():
    extraction = ClaimExtraction(
        summary="s",
        claims=[
            ClaimDraft(text="Cites a hallucinated source.", confidence="high", source_numbers=[7]),
            ClaimDraft(text="Partially valid.", confidence="high", source_numbers=[1, 9, 1]),
        ],
    )
    result = await Researcher(FakeLlm(GROUNDED, extraction)).research("q" * 20)

    # Claim citing only nonexistent sources: citations emptied, confidence forced low
    assert result.claims[0].source_positions == []
    assert result.claims[0].confidence == "low"
    # Out-of-range numbers dropped, duplicates deduped, confidence preserved
    assert result.claims[1].source_positions == [1]
    assert result.claims[1].confidence == "high"


async def test_no_sources_still_produces_low_confidence_claims():
    grounded = GroundedAnswer(text="Answer without grounding.", sources=[])
    extraction = ClaimExtraction(
        summary="s",
        claims=[ClaimDraft(text="Unsourced claim.", confidence="high", source_numbers=[1])],
    )
    result = await Researcher(FakeLlm(grounded, extraction)).research("q" * 20)

    assert result.sources == []
    assert result.claims[0].confidence == "low"
