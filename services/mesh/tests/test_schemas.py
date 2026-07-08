import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from mesh.schemas import RunRequested

CONTRACT = (
    Path(__file__).parents[2].parent
    / "packages" / "contracts" / "messages" / "research-run-requested.v1.json"
)

VALID = {
    "runId": "5a6c1a1e-9d1f-4d3a-8a52-0f6f6c1c2d3e",
    "userId": "1b2d3f4a-5c6e-4788-99aa-bbccddeeff00",
    "question": "What is the current state of solid-state battery commercialization?",
    "requestedAt": "2026-07-08T17:00:00Z",
}


def test_valid_message_parses():
    message = RunRequested.model_validate(VALID)
    assert str(message.run_id) == VALID["runId"]
    assert message.question == VALID["question"]


def test_contract_required_fields_match_model():
    contract = json.loads(CONTRACT.read_text())
    for field in contract["required"]:
        broken = {k: v for k, v in VALID.items() if k != field}
        with pytest.raises(ValidationError):
            RunRequested.model_validate(broken)


def test_question_length_enforced():
    with pytest.raises(ValidationError):
        RunRequested.model_validate({**VALID, "question": "too short"})
    with pytest.raises(ValidationError):
        RunRequested.model_validate({**VALID, "question": "x" * 501})


def test_unknown_fields_rejected():
    with pytest.raises(ValidationError):
        RunRequested.model_validate({**VALID, "isAdmin": True})
