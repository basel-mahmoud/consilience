import json
from uuid import uuid4

from mesh.schemas import AgentResult, Claim, MeshResult, ResearchResult, Source
from mesh.worker import handle_message


class RecordingTracer:
    def __init__(self):
        self.events: list[tuple[str, str, dict | None]] = []

    async def emit(self, type, message, data=None):
        self.events.append((type, message, data))


MESH = MeshResult(
    summary="s",
    agents=[
        AgentResult(
            lens_key="primary",
            lens_label="Primary evidence",
            result=ResearchResult(
                summary="s",
                claims=[Claim(position=1, text="c", confidence="high", source_positions=[1])],
                sources=[Source(position=1, url="https://a.gov", credibility="high")],
            ),
        )
    ],
)


class FakeRepo:
    async def claim_run(self, run_id, user_id):
        return True

    async def save_mesh_result(self, run_id, user_id, mesh):
        pass

    async def mark_failed(self, run_id, user_id, error):
        pass


class FakeMesh:
    def __init__(self, error=None):
        self.error = error

    async def run(self, question, tracer=None):
        if self.error:
            raise self.error
        return MESH


def message():
    return json.dumps(
        {
            "runId": str(uuid4()),
            "userId": str(uuid4()),
            "question": "What is the current state of solid-state batteries?",
            "requestedAt": "2026-07-08T17:00:00Z",
        }
    ).encode()


async def test_success_emits_started_and_completed():
    tracer = RecordingTracer()
    await handle_message(message(), FakeRepo(), FakeMesh(), lambda r, u: tracer)

    types = [e[0] for e in tracer.events]
    assert types[0] == "run.started"
    assert "run.completed" in types
    completed = next(e for e in tracer.events if e[0] == "run.completed")
    assert completed[2]["claims"] == 1


async def test_failure_emits_run_failed():
    import pytest

    tracer = RecordingTracer()
    with pytest.raises(RuntimeError):
        await handle_message(
            message(), FakeRepo(), FakeMesh(error=RuntimeError("boom")), lambda r, u: tracer
        )
    types = [e[0] for e in tracer.events]
    assert "run.started" in types
    assert "run.failed" in types
