# Launch readiness review

A milestone-9 assessment of where Consilience stands against production launch, what is verified, and the explicit steps remaining before a real commercial launch.

## Status by area

| Area | State | Evidence |
|---|---|---|
| Product surface | ✅ Complete | M0–M5: auth, multi-agent research, credibility, contradictions, evaluation, live trace, export |
| Authentication | ✅ | Clerk + stateless JWT verification; ownership on every resource |
| Data isolation | ✅ | Every query scoped by `user_id`; verified deletion cascade |
| Security hardening | ✅ | M6: headers, rate limiting, CodeQL, [SECURITY.md](SECURITY.md) audit |
| Testing | ✅ | Unit + contract tests in CI (gateway 28, mesh 42, engine 21); e2e/load harnesses |
| Legal & compliance | ✅ | Privacy, ToS, [DATA_HANDLING.md](DATA_HANDLING.md), deletion flow, trademark assessment |
| Accessibility | ✅ | Audit below |
| Performance | ✅ | Audit below |
| CI/CD | ✅ | GitHub Actions (4 jobs) + CodeQL on every push; Vercel auto-deploy |
| Observability | ✅ | Structured JSON logs; `trace_events` audit trail |
| Disaster recovery | ✅ | [docs/disaster-recovery.md](docs/disaster-recovery.md) — RTO/RPO, rollback |

## Accessibility audit

- **Semantic structure:** landmark `<main>`/`<header>`/`<nav>` regions; heading hierarchy per page.
- **Keyboard:** a skip-to-content link, a visible `:focus-visible` ring across all interactive elements, and native/labelled controls throughout (the theme toggle is a proper `radiogroup`).
- **Screen readers:** the live agent trace is an `aria-live="polite"` region so new events are announced; loading spinners use `role="status"` with the decorative spinner marked `aria-hidden`; errors use `role="alert"`.
- **Motion:** all animation (trace rows, transitions) is disabled under `prefers-reduced-motion`.
- **Color:** the ink/paper and confidence palettes were chosen for contrast in both themes; the confidence scale is always paired with a text label, never color alone.

## Performance audit

- **Fonts** self-hosted and optimized via `next/font` (no layout shift, no external requests).
- **Code splitting:** the SignalR client is only in the `LiveTrace` client component, so it stays out of the initial bundle for every other page; all pages except the dynamic dashboard routes are statically prerendered.
- **Data:** every hot query path is indexed (verified in the M6 audit); the gateway holds a single pooled `NpgsqlDataSource`.
- **Payloads:** request bodies capped at 64 KB; trace events stream incrementally rather than polling large payloads.

## Remaining before a real commercial launch

These are deliberately **out of portfolio scope** and listed for honesty:

1. **Host the backend services.** The gateway, engine, and mesh run locally today; the deployed web app runs in web-only mode. Containerize and deploy them (Docker images exist for local dev), and set the production `NEXT_PUBLIC_GATEWAY_URL`.
2. **Managed broker + Postgres for prod** (CloudAMQP + Neon prod branch), with secrets in the host secret manager.
3. **Clerk production instance** (custom domain, real OAuth credentials).
4. **A dedicated, paid LLM key** — the portfolio used a shared free-tier Gemini key whose daily quota is easily exhausted.
5. **Complete the live trademark clearance** ([docs/legal/trademark-check.md](docs/legal/trademark-check.md)) before commercial use of the name.
6. **Wire alerting** (error-rate threshold → notification) and uptime monitoring.

## Verdict

The product is **feature-complete and hardened to portfolio-flagship standard**: every milestone shipped, CI green, security and compliance addressed, and the full research pipeline verified end to end. What remains is infrastructure provisioning for a commercial launch, not product or engineering work.
