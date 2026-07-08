# Changelog

All notable changes to Consilience, one entry per milestone.

## [0.1.0] — 2026-07-08 · Milestone 0: Foundation

**Shipped**

- Repository, polyglot folder structure (`apps/web`, `services/{gateway,mesh,engine}`, `packages/contracts`, `infra`, `docs`), and CI (lint + build on every push/PR) with Dependabot scanning
- Architecture: system overview with data-flow diagram, plus ADRs 001–004 (polyglot services, RabbitMQ over Kafka, Neon Postgres, Clerk auth)
- Brand: name chosen after trademark screening (Consilience — independent lines of evidence converging), original SVG mark, theme-aware favicon
- Design system proof: color tokens (light/dark), dedicated per-claim confidence scale, type ramp (Newsreader/Inter/JetBrains Mono), radii — living reference at `/styleguide`
- Next.js 16 app deployed to Vercel; Neon Postgres project provisioned (`consilience`)

**Architecture notes**

- RabbitMQ chosen as broker: workload is task dispatch (work queues, retries via dead-letter exchanges), not stream processing — see ADR-002
- Single Neon Postgres as system of record with pgvector planned for embeddings — see ADR-003

**Next**

- Milestone 1: Clerk auth end-to-end through the .NET gateway, dashboard shell, dark/light mode toggle
