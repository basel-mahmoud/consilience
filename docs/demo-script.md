# Demo video script

A ~3-minute walkthrough for a demo recording. Assumes all services running locally with a working LLM key. Timings are approximate.

## 0:00 — Hook (15s)

> "Most AI research tools are a single model answering in one pass. Consilience runs a *mesh* of independent agents that research the same question from different angles, cross-check each other, and tell you exactly where they disagree — with a confidence score and a source on every claim."

Show the landing page: the mark (three lines converging on a point), the tagline.

## 0:15 — Sign in & dashboard (20s)

- Sign in with Clerk.
- Land on the dashboard: the empty state, the "Start research run" box.
- Note the polyglot architecture out loud: ".NET gateway for auth, a Python agent mesh, and a Java workflow engine — coordinated over RabbitMQ."

## 0:35 — Start a run & the live trace (50s)

- Type a genuinely contested question, e.g. *"Is nuclear power a safe and cost-effective way to cut emissions?"*
- Submit. Cut to the run page.
- **This is the centerpiece:** the live trace timeline animating in over SignalR — `run.started`, the three lenses (primary evidence, expert analysis, skeptical review) starting and completing in parallel, `synthesis`, `contradictions`.
- Narrate: "Three agents, each with a different research strategy, running concurrently. Everything you see is streaming live from the mesh."

## 1:25 — The report (45s)

- The run completes. Walk through the report top to bottom:
  - **Synthesis** — the cross-agent answer, noting agreement and disagreement.
  - **Evaluation panel** — grounding, source quality, consistency, corroboration. Point at a *low consistency* score: "The agents disagreed a lot here — and that's the signal, not a bug."
  - **Contradictions** — two claims that conflict, with the explanation.
  - **Claims** — each with a confidence badge, the contributing agent, and citation numbers. Show a claim downgraded because it was contradicted.
  - **Sources** — numbered, each with a credibility tier (gov/edu = high, blog = low).

## 2:10 — Human-in-the-loop gate (25s)

- Start a *sensitive* question, e.g. *"What's the right medication dosage for…"*.
- Show it land in **Awaiting approval** with the reason, held before any agent runs.
- Approve it: "The Java engine flags high-stakes topics for a human checkpoint before spending compute or presenting authoritative-looking claims."

## 2:35 — Export & close (25s)

- Click **Export report** → the cited Markdown downloads.
- Quick flash of: the security posture (SECURITY.md), the CI going green across four languages, and the account-deletion flow in Settings.
- Close: "Independent evidence, converging on verified claims — with the disagreements kept in view. That's Consilience."

## B-roll / cutaways

- The architecture diagram from [docs/architecture/system-overview.md](architecture/system-overview.md).
- The `/styleguide` page for the design system.
- The GitHub repo: green CI, the milestone-by-milestone changelog.
