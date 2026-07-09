# Changelog

All notable changes to Consilience, one entry per milestone.

## [0.9.0] — 2026-07-09 · Milestone 5b: Report export with citations

**Shipped**

- **Export report** button on completed runs: downloads a self-contained, fully-cited Markdown report built from the run's data — title, an AI-generated-content disclaimer, synthesis, evaluation scores, numbered claims (with per-claim confidence, contributing agent, and citation references), cross-agent contradictions, and a numbered source list with credibility
- The report builder (`lib/report.ts`) is a pure, deterministic function; the export happens entirely client-side (a Blob download), so it needs no backend round-trip and works from any completed run already on screen
- Source-derived filename slug (e.g. `consilience-is-nuclear-power-cost-effective.md`)

**Verified**

- Ran the real report builder against a representative completed run and confirmed correct structure and citations end to end (claims cite `[1][2]`, contradictions reference claim positions, sources numbered with credibility, disclaimer present)

**Next**

- Milestone 6: security hardening pass — full audit against the access-control, input-validation, rate-limiting, secrets, and observability checklist

## [0.8.0] — 2026-07-09 · Milestone 5a: Real-time agent-trace streaming

**Shipped**

- The mesh now **narrates each run** as it happens: trace events (`run.started`, `agent.started/completed` per lens, `synthesis`, `contradictions`, `run.completed/failed`) published to `trace.event` with a monotonic per-run sequence; emission is best-effort and never fails the research
- Gateway `TraceRelay` (hosted service) consumes `trace.event`, persists each to a new `trace_events` table (idempotent on `(run_id, seq)`; doubles as the agent-activity audit trail), and fans it out over **SignalR** (`/hubs/trace`) to the run's owner
- SignalR auth reuses Clerk (token via `?access_token=` since WebSockets can't set headers); the hub verifies run ownership before a client joins the run's group; `GET /api/runs/{id}/trace` replays recorded events so a browser connecting mid-run still gets the whole story
- Dashboard **live trace timeline**: connects to the hub, renders events as they arrive with a subtle motion-in (respecting `prefers-reduced-motion`), and shows the recorded trace on completed/failed runs
- Tests: mesh grows to 40 (trace emission on success and failure); gateway stays at 21 with the SignalR layer wired in (the trace relay is excluded from the test host, which has no broker)

**Verified**

- Trace path live end to end: seven synthetic trace events published to the broker were consumed by the running gateway relay and persisted to `trace_events` in correct sequence order, confirming mesh → broker → gateway → database
- Not verifiable this session (environment, not code): the SignalR push to a browser and the visual timeline — the preview sandbox couldn't reach the local dev server, and Gemini's exhausted daily quota blocked a fresh live agent run. The relay-to-hub fan-out and the hub's ownership check reuse the same verified auth path as the tested REST endpoints.

**Next**

- Milestone 5b: report export with citations

## [0.7.0] — 2026-07-09 · Milestone 4b: Human-in-the-loop approval gate

**Shipped**

- **Approval-gate rules engine** (`ApprovalRules`): a transparent keyword policy that flags runs whose question touches a sensitive domain (medical, legal, financial, safety) for human review — because the mesh presents confident, cited-looking claims, those topics get a checkpoint before compute is spent
- Engine now applies **rate limit → approval gate → dispatch** in order; a flagged run is marked `awaiting_approval` with the reason and held (not dispatched)
- **Approve/reject flow**: gateway endpoints `POST /api/runs/{id}/approve` and `/reject` (ownership-scoped); approve re-queues the run and publishes `run.approved`, which the engine consumes on `engine.approvals` and dispatches without re-running the rules; reject marks the run `rejected`
- New run statuses (`awaiting_approval`, `rejected`) and an `approval_reason` column (Neon MCP migration); `run.approved` documented in `packages/contracts`
- Dashboard: the run view shows an **Approve & run / Reject** panel with the reason when a run is awaiting approval, and dedicated states for rejected and rate-limited runs
- Tests: engine grows to 18 (approval rules across sensitive/ordinary questions, processor awaiting-approval path, rate-limit-takes-precedence); gateway grows to 21 (approve/reject success, ownership 404, wrong-state 404); all four CI jobs green

**Verified**

- Full approval loop live: a medical-dosage question was flagged `awaiting_approval` with the domain reason and held with zero agents run; after a simulated approval (re-queue + `run.approved`), the engine dispatched it to the mesh — confirming the gate, the hold, and the approve→dispatch handoff end to end
- The dispatched research itself hit Gemini's (now fully exhausted) free-tier daily quota; the M4a dispatch test had already confirmed a dispatched run completes end to end

**Next**

- Milestone 5: real-time live trace UI (WebSocket/SignalR streaming of agent activity) and report export with citations

## [0.6.0] — 2026-07-09 · Milestone 4a: Workflow engine (rate limiting + dispatch)

**Shipped**

- New Java service (`services/engine`, JDK 21 + Gradle) inserted in front of the mesh: the gateway now publishes `run.requested` to the **engine**, which applies policy and relays cleared runs to the mesh on `agent.dispatch` (the mesh rebinds from `run.requested`)
- **Per-user rate limiting**: a sliding one-hour window (default 10 runs/user/hour, `ENGINE_MAX_RUNS_PER_HOUR`); runs over the cap are marked `rate_limited` with the reason recorded, never dispatched — a guard against runaway LLM cost
- **Retry with exponential backoff** on dispatch (publisher confirms); a dispatch that ultimately fails marks the run `failed` and dead-letters the message; invalid messages are dead-lettered, never dropped
- `rate_limited` added to the run status set (Neon MCP migration); the two-key broker topology (`run.requested` → engine, `agent.dispatch` → mesh) is documented in `packages/contracts`
- Tests: 8 engine unit tests (retry success/exhaustion/backoff-doubling, run processor dispatch/at-limit/over-limit/failure) with fakes — no broker or DB; CI gains a Java (Gradle + spotless) job; Dependabot covers gradle

**Verified**

- Rate-limit path live: a run under a limit of 1 (with prior runs in the window) was correctly marked `rate_limited` and never dispatched
- Full pipeline live end-to-end: gateway → engine (dispatched) → mesh → `completed` (3 agents, 26 claims, evaluations scored) in 29s

**Architecture notes**

- The engine and gateway apply complementary limits: the gateway caps concurrent active runs (3, immediate 429 feedback), the engine caps throughput per hour (cost control)
- Two live-test stalls this session traced to orphaned child processes surviving a wrapper-only kill; resolved by killing the actual JVM/python PIDs and verifying they exit

**Next**

- Milestone 4b: the human-in-the-loop approval gate and its rules engine — flag sensitive runs for approval before dispatch, with approve/reject from the dashboard

## [0.5.0] — 2026-07-09 · Milestone 3b: Contradiction detection + evaluation

**Shipped**

- Cross-agent **contradiction detection**: after the agents produce their claims, a synthesis-model pass identifies pairs of claims that genuinely conflict (validated to in-range, non-self, deduped pairs); results persist to a new `contradictions` table linking the two claims with an explanation
- **Confidence downgrade on disagreement**: any claim caught in a contradiction has its confidence lowered one level (high→mid→low) — the mesh's core idea that unchallenged claims are trusted more than contested ones, made concrete
- **Evaluation harness** (`evaluation.py`, deterministic, no LLM): scores every run 0–1 on grounding (claims that cite sources), source quality (credibility-weighted), consistency (1 − share of contradicted claims), and corroboration (share of agents contributing); persists to `run_evaluations`
- Resilience: contradiction detection and synthesis failures are non-fatal (the run still completes); both covered by tests
- Gateway run detail returns contradictions (as claim-position pairs) and evaluation scores; the run view adds an evaluation panel and a contradictions section, and numbers each claim so citations and contradiction references resolve
- Tests: mesh suite grows to 38 (evaluation metrics with exact expected values incl. divide-by-zero guards, contradiction downgrade, finder-failure tolerance); gateway 15 still green

**Verified**

- Live run on a deliberately contested question ("is nuclear power safe and cost-effective?"): 3/3 agents, 26 claims, **25 contradictions** surfaced; confidence redistributed to 3 high / 17 mid / 6 low by the downgrade pass; evaluation scored grounding 1.0, source quality 0.61, corroboration 1.0, and **consistency 0.15** — correctly flagging the topic as heavily disputed
- Resilience verified live under real Gemini free-tier quota exhaustion: agents retried with backoff, then failed gracefully; the run was marked failed and its message dead-lettered exactly as designed

**Next**

- Milestone 4: Java workflow/event engine — job queue, retries with backoff, rate limiting, and the human-in-the-loop approval gate before risky agent actions

## [0.4.0] — 2026-07-09 · Milestone 3a: Parallel multi-agent mesh + credibility

**Shipped**

- Multi-agent orchestration (`orchestrator.py`): one research agent per **lens** — primary evidence, expert analysis, skeptical review — run concurrently, each producing its own grounded search, claims, and sources; a synthesis pass writes a cross-agent run summary
- Partial-failure tolerance: a run completes on surviving agents if some fail; only a total wipeout fails the run (and synthesis failure falls back to an agent summary rather than failing the run)
- Deterministic **source credibility** scoring (`credibility.py`): every source is ranked high/mid/low by domain class (gov/edu/primary → high, established outlets/orgs → mid, user-generated/unknown → low), correctly resolving the real domain behind search-grounding redirect URLs
- Per-agent attribution persisted: new `run_agents` table, and `run_agent_id` + `credibility` on sources/claims (Neon MCP migration, verified on a temp branch)
- Gateway run detail now returns each claim's agent and each source's credibility; the run view shows a per-lens summary strip, agent tags on claims, and credibility on sources
- Tests: mesh suite grows to 31 (credibility tiers incl. redirect-domain resolution, orchestrator parallelism/partial-failure/synthesis-fallback); gateway 15 still green

**Verified**

- Live multi-agent run ("coffee & cardiovascular health"): 3/3 agents succeeded in parallel, 80 claims / 64 sources, with credibility spread across high (nih.gov, harvard.edu, europa.eu), mid (ahajournals.org, endocrine.org), and low (commercial/blog) — persisted and attributed per agent in Neon

**Fixed**

- Search-grounding returns redirect-wrapper URLs with the real domain in the citation title; credibility scoring now reads that domain instead of scoring the wrapper (which had made every source "low")

**Next**

- Milestone 3b: contradiction detection across agents' claims, confidence adjustment from agreement, and the evaluation scoring harness

## [0.3.0] — 2026-07-09 · Milestone 2: Single-agent research flow

**Shipped**

- Python mesh service (`services/mesh`): consumes `run.requested` from RabbitMQ, runs a single research agent (Gemini grounded search → structured claim extraction), and persists summary, claims, sources, and claim↔source citations to Neon in one transaction
- Message broker: RabbitMQ topology (topic exchange `consilience`, durable queue `mesh.run-requests`, dead-letter exchange for poison messages); the first schema (`ResearchRunRequested` v1) lives in `packages/contracts`
- Gateway run API: `POST /api/runs` (validates, enforces a 3-active-run cap with 429, creates the row, publishes with broker confirms, marks failed on dispatch error), `GET /api/runs`, `GET /api/runs/{id}` — all ownership-scoped by internal user id
- New Neon tables (`runs`, `sources`, `claims`, `claim_sources`) with indexes, applied via the Neon MCP migration flow
- Frontend research flow: "Start research run" form (server action), runs list with status pills, and a run detail page rendering claims with per-claim confidence and numbered source citations; in-progress runs poll until complete, with graceful degradation when the gateway is absent (deployed web-only mode)
- LLM model routing (cheap search model vs. configurable synthesis model), retry-with-backoff for external calls, and prompt-injection-safe handling of retrieved web content
- Tests: 15 gateway integration tests (run creation, validation, 429, ownership 404) and 12 mesh tests (contract validation, claim/source mapping with hallucinated-citation dropping and unsourced-claim downgrade, worker dispatch/failure/dead-letter); CI gains a Python (uv + ruff + pytest) job; Dependabot covers uv

**Verified**

- Full pipeline exercised end-to-end with a live Gemini run: a real question produced 33 claims with 151 claim→source citations across 12 sources, written to Neon and marked completed in 29s

**Architecture notes**

- Claims that cite only sources the agent didn't actually retrieve are downgraded to low confidence — a guard against ungrounded assertions that becomes richer with multi-agent cross-checking in M3
- Redelivered messages re-claim `running` runs so a mid-flight worker crash restarts cleanly rather than stranding the run

**Next**

- Milestone 3: multiple parallel agents, contradiction detection, credibility ranking, evaluation harness

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
