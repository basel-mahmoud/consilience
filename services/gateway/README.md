# Gateway (ASP.NET Core)

The only public-facing service. Owns:

- Clerk JWT verification and tenant/user management ([ADR-004](../../docs/adr/004-clerk-authentication.md))
- The REST API surface (OpenAPI-documented) and resource-ownership enforcement
- Plan gating and audit logging
- SignalR hub streaming live agent-trace events to the browser

**Status**: scaffolded in Milestone 1 (auth end-to-end). Run instructions land with the code.
