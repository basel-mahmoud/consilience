# Changelog

All notable changes to Consilience, one entry per milestone.

## [0.2.0] — 2026-07-08 · Milestone 1: Auth end-to-end

**Shipped**

- Clerk authentication in the web app: sign-in/sign-up pages, route protection via `proxy.ts` (`/dashboard` requires a session), auth-aware landing page
- ASP.NET Core gateway (`services/gateway`): stateless Clerk JWT verification against JWKS with `azp` allow-listing, CORS locked to approved origins, structured JSON logging, OpenAPI
- `users` table in Neon (applied via the Neon MCP migration flow, verified on a temporary branch first); the gateway upserts users on authenticated requests — the tenancy anchor for future resources
- Dashboard shell: sidebar navigation, designed zero-state stats, empty state for runs, and a live gateway-session indicator that proves the end-to-end auth path
- Explicit light/dark/system theme toggle (next-themes, `data-theme` tokens), replacing OS-only switching
- 7 gateway auth-middleware tests (missing/expired/tampered token, `azp` allow/deny, identity echo, user upsert) running the real pipeline against a local signing key; CI extended with a .NET job; Dependabot now covers nuget
- Pinned `Microsoft.OpenApi` past a known high-severity advisory (NU1903) surfaced by the template's transitive dependency

**Architecture notes**

- Next 16 renamed `middleware.ts` to `proxy.ts`; Clerk v7 drops `SignedIn/SignedOut` in server components in favor of `auth()`
- Clerk session tokens carry the origin in `azp` (not `aud`); the gateway validates it against the same origin list used for CORS

**Next**

- Milestone 2: Python mesh — single-agent research flow, source retrieval, citation extraction

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
