# Contracts

Single source of truth for every cross-service boundary:

- **REST**: OpenAPI spec for the gateway's public API
- **Messages**: JSON Schemas for broker messages (`ResearchRunRequested`, `AgentTask`, `TraceEvent`, `TaskResult`, …)

Rules:

1. A boundary change starts here, in the same PR as the implementation.
2. Consumers validate inbound messages against these schemas — unknown or invalid messages are rejected, logged, and dead-lettered, never guessed at.

First schemas land in Milestone 1 (gateway OpenAPI) and Milestone 2 (run/task messages).
