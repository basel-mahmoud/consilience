# ADR-001: Polyglot service architecture

**Status**: Accepted · 2026-07-08

## Context

The platform has three clearly separable concerns: a secure public API surface with real-time streaming, an ML/LLM-heavy agent runtime, and a reliability-focused job execution engine. A single-stack implementation was considered.

## Decision

Three backend services in three stacks, each owning the concern its ecosystem is strongest at:

- **ASP.NET Core gateway** — mature auth middleware, first-class WebSocket support via SignalR (connection management, reconnection, and group fan-out built in), strong typing for the public API contract.
- **Python mesh** — the LLM/embeddings ecosystem (clients, tokenizers, vector math, eval tooling) is Python-native; fighting that from another stack costs more than the polyglot overhead.
- **Java engine** — the JVM's concurrency primitives and battle-tested scheduling/queueing libraries fit a component whose whole job is reliable, concurrent, stateful task execution.

## Consequences

- Higher operational surface (three runtimes) — mitigated by Docker Compose for dev parity and strict contract-first boundaries in `packages/contracts`.
- No shared in-process code — all coordination happens over RabbitMQ and Postgres, which forces the service boundaries to stay honest.
- Each service can be tested, deployed, and scaled independently.
