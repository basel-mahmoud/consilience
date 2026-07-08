import pytest

from mesh.lenses import Lens
from mesh.orchestrator import Orchestrator
from mesh.schemas import Claim, ResearchResult, Source

LENSES = (
    Lens(key="a", label="Lens A", guidance="angle a"),
    Lens(key="b", label="Lens B", guidance="angle b"),
    Lens(key="c", label="Lens C", guidance="angle c"),
)


def result_for(guidance: str) -> ResearchResult:
    return ResearchResult(
        summary=f"summary from {guidance}",
        claims=[
            Claim(position=1, text=f"claim {guidance}", confidence="high", source_positions=[1])
        ],
        sources=[Source(position=1, url="https://a.gov/x", credibility="high")],
    )


class FakeAgent:
    def __init__(self, fail_guidance: set[str] | None = None):
        self.fail = fail_guidance or set()
        self.calls: list[str | None] = []

    async def research(self, question, guidance=None):
        self.calls.append(guidance)
        if guidance in self.fail:
            raise RuntimeError(f"agent failed for {guidance}")
        return result_for(guidance or "default")


class FakeSynth:
    def __init__(self, fail: bool = False):
        self.fail = fail
        self.findings = None

    async def synthesize(self, question, findings):
        self.findings = findings
        if self.fail:
            raise RuntimeError("synth down")
        return "cross-agent synthesis"


async def test_runs_all_lenses_in_parallel_and_attributes():
    agent = FakeAgent()
    mesh = await Orchestrator(agent, FakeSynth(), LENSES).run("q" * 20)

    assert len(mesh.agents) == 3
    assert {a.lens_key for a in mesh.agents} == {"a", "b", "c"}
    assert mesh.summary == "cross-agent synthesis"
    # Each lens's guidance reached its agent
    assert set(agent.calls) == {"angle a", "angle b", "angle c"}


async def test_partial_agent_failure_still_completes_on_survivors():
    agent = FakeAgent(fail_guidance={"angle b"})
    synth = FakeSynth()
    mesh = await Orchestrator(agent, synth, LENSES).run("q" * 20)

    assert {a.lens_key for a in mesh.agents} == {"a", "c"}
    # Synthesis only sees the survivors, not the failed lens
    assert {label for label, _ in synth.findings} == {"Lens A", "Lens C"}


async def test_total_failure_raises():
    agent = FakeAgent(fail_guidance={"angle a", "angle b", "angle c"})
    with pytest.raises(RuntimeError, match="all research agents failed"):
        await Orchestrator(agent, FakeSynth(), LENSES).run("q" * 20)


async def test_synthesis_failure_falls_back_to_first_agent_summary():
    mesh = await Orchestrator(FakeAgent(), FakeSynth(fail=True), LENSES).run("q" * 20)
    assert mesh.summary == mesh.agents[0].result.summary
