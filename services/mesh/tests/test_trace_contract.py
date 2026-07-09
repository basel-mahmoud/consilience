import json
from pathlib import Path
from uuid import uuid4

from mesh.trace import RabbitTracer

CONTRACT = (
    Path(__file__).parents[2].parent
    / "packages" / "contracts" / "messages" / "trace-event.v1.json"
)


class FakeMessage:
    def __init__(self, body):
        self.body = body


class FakeExchange:
    """Captures what the tracer would publish, without a broker."""

    def __init__(self):
        self.published: list[dict] = []

    async def publish(self, message, routing_key):
        self.published.append(json.loads(message.body))


async def test_emitted_events_match_the_contract():
    contract = json.loads(CONTRACT.read_text())
    required = contract["required"]
    allowed_types = set(contract["properties"]["type"]["enum"])

    exchange = FakeExchange()
    run_id, user_id = uuid4(), uuid4()
    tracer = RabbitTracer(exchange, run_id, user_id)

    await tracer.emit("run.started", "Dispatching research agents")
    await tracer.emit("agent.completed", "Primary: 9 claims", {"lens": "primary", "claims": 9})

    assert len(exchange.published) == 2
    for event in exchange.published:
        for field in required:
            assert field in event, f"missing required field {field}"
        assert event["type"] in allowed_types
        assert event["runId"] == str(run_id)
        assert event["userId"] == str(user_id)

    # Sequence is monotonic per run
    assert [e["seq"] for e in exchange.published] == [0, 1]
    # data is optional and only present when supplied
    assert "data" not in exchange.published[0]
    assert exchange.published[1]["data"] == {"lens": "primary", "claims": 9}


async def test_emit_never_raises_when_the_broker_fails():
    class BrokenExchange:
        async def publish(self, message, routing_key):
            raise RuntimeError("broker down")

    tracer = RabbitTracer(BrokenExchange(), uuid4(), uuid4())
    # Tracing is best-effort — a broker failure must not propagate into the run
    await tracer.emit("run.started", "should not raise")
