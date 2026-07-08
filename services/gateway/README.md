# Gateway (ASP.NET Core)

The only public-facing service. As of Milestone 1 it owns:

- **Clerk JWT verification** ([ADR-004](../../docs/adr/004-clerk-authentication.md)): stateless validation against Clerk's JWKS, `azp` checked against the allowed origins list
- **User records**: upserts a `users` row (see [migrations](migrations)) on each authenticated request — the tenancy anchor for everything that follows
- **CORS** locked to the origins in `appsettings.json`
- Structured JSON logging; OpenAPI served at `/openapi/v1.json`

Coming in later milestones: research-run endpoints, plan gating, audit log, SignalR trace streaming.

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
