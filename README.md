<p align="center">
  <img src="docs/brand/logo.svg" width="72" alt="Consilience logo" />
</p>

<h1 align="center">Consilience</h1>

<p align="center">
  Multi-agent research that converges on verified claims.<br/>
  Independent AI agents gather sources, extract claims, cross-check each other,
  flag contradictions, and produce a report with per-claim confidence and full attribution.
</p>

---

## What it does

Submit a research question. Consilience dispatches multiple specialized agents that work in parallel:

- **Gather** — each agent independently retrieves sources and extracts claims
- **Cross-check** — agents verify each other's findings and flag contradictions
- **Rank** — evidence is scored for source credibility
- **Converge** — a synthesis pass resolves conflicts into a final report with a confidence score per claim

You can watch the mesh work in real time (live trace of every agent action, source pull, and disagreement), intervene mid-run (approve/reject sources, redirect agents), and export the final cited report.

## Architecture

Polyglot by design — each service owns a responsibility its stack is genuinely best at:

| Service | Stack | Responsibility |
|---|---|---|
| [`apps/web`](apps/web) | Next.js (App Router) + TypeScript | Dashboard, live trace view, report UI |
| [`services/gateway`](services/gateway) | ASP.NET Core (C#) | Public API, Clerk auth, tenancy, audit log, SignalR trace streaming |
| [`services/mesh`](services/mesh) | Python | Agent runtime: orchestration, LLM routing, credibility scoring, contradiction detection, eval harness |
| [`services/engine`](services/engine) | Java | Workflow engine: job dispatch, retries/backoff, rate limiting, human-approval rules |

```mermaid
flowchart LR
    B[Browser<br/>Next.js on Vercel] -->|REST + WebSocket| G[.NET Gateway<br/>auth · audit · SignalR]
    G -->|ResearchRunRequested| MQ[(RabbitMQ)]
    MQ --> E[Java Engine<br/>scheduling · retries · approval gates]
    E -->|AgentTask| MQ
    MQ --> M[Python Mesh<br/>agents · scoring · synthesis]
    M -->|TraceEvent| MQ
    MQ -->|TraceEvent| G
    G -.->|live trace| B
    M --> DB[(Neon Postgres)]
    G --> DB
```

Services communicate through documented contracts in [`packages/contracts`](packages/contracts). Key decisions are recorded as ADRs in [`docs/adr`](docs/adr).

## Status

| Milestone | Scope | Status |
|---|---|---|
| 0 | Repo, architecture, brand, design system, DB + auth provisioning, CI | ✅ Shipped |
| 1 | Auth end-to-end (Clerk ↔ .NET gateway), dashboard shell, theme toggle | ✅ Shipped |
| 2 | Single-agent research flow (Python mesh + RabbitMQ), sources & citations | ✅ Shipped |
| 3 | Multi-agent mesh, contradiction detection, eval harness | ⏳ Next |
| 4 | Workflow engine: queue, retries, rate limits, approval gates | Planned |
| 5 | Real-time trace UI, report export | Planned |
| 6 | Security hardening audit | Planned |
| 7 | Full testing pass (unit/integration/e2e/load) | Planned |
| 8 | Legal & compliance (privacy, ToS, data handling) | Planned |
| 9 | Accessibility, performance, launch readiness | Planned |

See [CHANGELOG.md](CHANGELOG.md) for per-milestone detail.

## Local development

```bash
# Frontend
cd apps/web
npm install
cp ../../.env.example .env.local   # fill in values — see comments in the file
npm run dev

# Broker (Docker) — or use any local RabbitMQ
docker compose -f infra/docker-compose.yml up -d

# Gateway (requires .NET 10 SDK)
cd services/gateway/src/Consilience.Gateway
DATABASE_URL="postgresql://…" RABBITMQ_URL="amqp://guest:guest@localhost:5672" dotnet run

# Mesh worker (requires uv + a GEMINI_API_KEY)
cd services/mesh
uv run python -m mesh.worker
```

With all three running, a research question submitted in the dashboard is dispatched by the gateway over RabbitMQ, researched by the mesh, and streamed back into the run view (polling in M2; live WebSocket trace in M5). Without the gateway, the app runs in web-only mode. The `engine` service comes online in Milestone 4. All environment variables are documented in [`.env.example`](.env.example); no secrets are ever committed.

## Documentation

- [System architecture](docs/architecture/system-overview.md)
- [Architecture Decision Records](docs/adr)
- [Design system](apps/web/README.md) — tokens, type, color; live at `/styleguide`
