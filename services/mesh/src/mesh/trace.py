"""Trace-event emission for the live run view.

The mesh narrates a run as it happens; the gateway relays these to the browser.
Emission is best-effort: a broker hiccup must never fail the research itself.
"""

import json
import logging
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

import aio_pika

log = logging.getLogger(__name__)

TRACE_ROUTING_KEY = "trace.event"


class Tracer(Protocol):
    async def emit(self, type: str, message: str, data: dict | None = None) -> None: ...


class NullTracer:
    """No-op tracer for tests and when tracing is disabled."""

    async def emit(self, type: str, message: str, data: dict | None = None) -> None:
        return None


class RabbitTracer:
    """Publishes trace events for one run, numbering them with a per-run sequence."""

    def __init__(self, exchange: aio_pika.abc.AbstractExchange, run_id: UUID, user_id: UUID):
        self._exchange = exchange
        self._run_id = run_id
        self._user_id = user_id
        self._seq = 0

    async def emit(self, type: str, message: str, data: dict | None = None) -> None:
        event = {
            "runId": str(self._run_id),
            "userId": str(self._user_id),
            "seq": self._seq,
            "type": type,
            "message": message,
            "at": datetime.now(UTC).isoformat(),
        }
        if data is not None:
            event["data"] = data
        self._seq += 1
        try:
            await self._exchange.publish(
                aio_pika.Message(
                    body=json.dumps(event).encode(),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key=TRACE_ROUTING_KEY,
            )
        except Exception:
            log.warning("failed to emit trace event %s for run %s", type, self._run_id,
                        exc_info=True)
