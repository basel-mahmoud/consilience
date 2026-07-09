# Gateway (ASP.NET Core)

The only public-facing service. As of Milestone 1 it owns:

- **Clerk JWT verification** ([ADR-004](../../docs/adr/004-clerk-authentication.md)): stateless validation against Clerk's JWKS, `azp` checked against the allowed origins list
- **User records**: upserts a `users` row (see [migrations](migrations)) on each authenticated request — the tenancy anchor for everything that follows
- **Research-run API**: create/list/get runs, approve/reject gated runs (all ownership-scoped)
- **Live trace streaming**: a `TraceRelay` hosted service consumes `trace.event` from the mesh, persists each event to `trace_events`, and fans it out over **SignalR** (`/hubs/trace`) to the run's owner; `GET /api/runs/{id}/trace` replays recorded events
- **CORS** locked to the origins in `appsettings.json`
- Structured JSON logging; OpenAPI served at `/openapi/v1.json`

SignalR clients authenticate with the Clerk token passed as `?access_token=` (WebSockets can't set headers); the hub verifies run ownership before a client joins the run's group.

## Run

Requires the .NET 10 SDK and a `DATABASE_URL` (Neon connection string, `postgresql://` format):

```bash
cd src/Consilience.Gateway
DATABASE_URL="postgresql://…" dotnet run   # http://localhost:5180
```

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /health` | none | liveness |
| `GET /api/me` | Bearer (Clerk JWT) | verifies the session, upserts the user, echoes identity |

TLS terminates at the host in deployment; local development runs plain HTTP on `localhost` only.

## Test

```bash
dotnet test
```

Tests run the real middleware pipeline against a local signing key (no network): missing/expired/tampered tokens are rejected, disallowed `azp` is rejected, valid tokens resolve identity and record the user.
