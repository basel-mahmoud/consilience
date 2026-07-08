# ADR-003: Neon Postgres as the system database

**Status**: Accepted · 2026-07-08

## Context

All three backend services need durable relational storage: runs, claims, sources, credibility scores, audit log, tenancy. The mesh additionally needs vector similarity search for embeddings.

## Decision

A single Neon Postgres project (`consilience`, project id `flat-bar-88026701`) as the system of record.

- One relational store keeps cross-service consistency simple (a run, its tasks, its claims, and its audit entries live in one transactional boundary) — appropriate at this scale versus per-service databases.
- `pgvector` covers embedding search without introducing a separate vector store.
- Neon specifics: serverless scale-to-zero fits a portfolio project's traffic profile; branching gives disposable schema-migration testing; the platform is managed through its MCP-driven tooling for provisioning and migrations, keeping schema changes scripted and reviewable rather than ad-hoc.

## Consequences

- Shared database across services requires discipline: each service owns its tables, cross-service access goes through the owning service's contract, and every query is tenant-scoped at the data layer.
- Connection pooling matters (serverless Postgres + three services) — use the pooled connection endpoint everywhere.
