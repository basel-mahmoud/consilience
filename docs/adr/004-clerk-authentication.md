# ADR-004: Clerk for authentication and session management

**Status**: Accepted · 2026-07-08

## Context

The product needs sign-up/sign-in, session management with short-lived tokens, and a user store — none of which are differentiating features worth building.

## Decision

Clerk, integrated at two points only:

- **`apps/web`** uses Clerk's Next.js SDK for sign-in UI and session handling (short-lived access tokens with automatic refresh).
- **`services/gateway`** verifies Clerk-issued JWTs on every request via Clerk's JWKS endpoint — stateless verification, no network call per request after key caching. The gateway maps the verified Clerk user ID to internal tenant records and enforces ownership on every resource access.

The mesh and engine never see end-user credentials; they trust the gateway's authenticated context passed in message metadata.

## Consequences

- Auth recovery flows, MFA, and token rotation are Clerk-managed — the security-sensitive surface we'd most likely get wrong is outsourced.
- Vendor coupling is contained: only the gateway's JWT-verification middleware and the web app's provider component touch Clerk APIs.
- User PII lives primarily in Clerk; our tables store the Clerk user ID plus app data, which minimizes stored PII (relevant to the Milestone 8 compliance pass).
