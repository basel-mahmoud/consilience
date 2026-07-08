import json
from uuid import UUID, uuid4

import pytest

from mesh.schemas import Claim, ResearchResult, Source
from mesh.worker import InvalidMessage, handle_message

RESULT = ResearchResult(
    summary="s",
    claims=[Claim(position=1, text="c", confidence="high", source_positions=[1])],
    sources=[Source(position=1, url="https://a.example")],
)


def message(run_id: UUID, user_id: UUID) -> bytes:
    return json.dumps(
        {
            "runId": str(run_id),
            "userId": str(user_id),
            "question": "What is the current state of solid-state batteries?",
            "requestedAt": "2026-07-08T17:00:00Z",
        }
    ).encode()


class FakeRepo:
    def __init__(self, claimable: bool = True):
        self.claimable = claimable
        self.saved: list[tuple[UUID, UUID, ResearchResult]] = []
        self.failed: list[tuple[UUID, UUID, str]] = []

    async def claim_run(self, run_id, user_id):
        return self.claimable

    async def save_result(self, run_id, user_id, result):
        self.saved.append((run_id, user_id, result))

    async def mark_failed(self, run_id, user_id, error):
        self.failed.append((run_id, user_id, error))


class FakeResearcher:
    def __init__(self, error: Exception | None = None):
        self.error = error
        self.calls = 0

    async def research(self, question):
        self.calls += 1
        if self.error:
            raise self.error
        return RESULT


async def test_success_path_saves_result():
    repo, run_id, user_id = FakeRepo(), uuid4(), uuid4()
    await handle_message(message(run_id, user_id), repo, FakeResearcher())
    assert repo.saved == [(run_id, user_id, RESULT)]
    assert repo.failed == []


async def test_unclaimable_run_is_skipped_without_research():
    repo = FakeRepo(claimable=False)
    researcher = FakeResearcher()
    await handle_message(message(uuid4(), uuid4()), repo, researcher)
    assert researcher.calls == 0
    assert repo.saved == []


async def test_research_failure_marks_run_failed_and_reraises():
    repo, run_id, user_id = FakeRepo(), uuid4(), uuid4()
    with pytest.raises(RuntimeError, match="boom"):
        await handle_message(
            message(run_id, user_id), repo, FakeResearcher(error=RuntimeError("boom"))
        )
    assert repo.failed[0][:2] == (run_id, user_id)
    assert "boom" in repo.failed[0][2]
    assert repo.saved == []


async def test_invalid_json_raises_invalid_message():
    with pytest.raises(InvalidMessage):
        await handle_message(b"not json", FakeRepo(), FakeResearcher())


async def test_schema_violation_raises_invalid_message():
    body = json.dumps({"runId": "not-a-uuid"}).encode()
    with pytest.raises(InvalidMessage):
        await handle_message(body, FakeRepo(), FakeResearcher())
