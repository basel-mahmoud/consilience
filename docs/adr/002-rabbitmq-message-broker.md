# ADR-002: RabbitMQ as the message broker

**Status**: Accepted · 2026-07-08

## Context

Gateway, engine, and mesh coordinate through asynchronous messages: run requests, agent task dispatch, trace events, and results. Kafka and RabbitMQ were the candidates.

## Decision

RabbitMQ.

The workload is **task dispatch**, not stream processing: work queues, per-agent routing, priorities, retries, and dead-lettering. That is AMQP's native model — dead-letter exchanges plus per-queue TTLs give the engine retry-with-backoff semantics almost for free, and publisher confirms + manual acks give at-least-once delivery without building offset management.

Kafka's strengths — replayable partitioned logs, very high throughput, stream processing — solve problems this system does not have at its scale, while adding significant operational weight (partition planning, consumer group tuning, KRaft).

Practical factors: official, well-maintained clients in C#, Python, and Java; a single lightweight container in Docker Compose; CloudAMQP's free tier provides a zero-cost hosted broker for the deployed demo.

## Consequences

- No message replay: trace events needed after the fact are persisted to Postgres by the mesh, not re-read from the broker.
- If throughput ever demanded Kafka, the contract-first message schemas in `packages/contracts` keep the migration surface small.
