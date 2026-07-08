# Engine (Java)

The workflow/event execution engine. Owns:

- Queue consumers and agent-task dispatch over RabbitMQ ([ADR-002](../../docs/adr/002-rabbitmq-message-broker.md))
- Job scheduling, retries with exponential backoff (dead-letter exchanges), idempotent redelivery handling
- Rate-limit enforcement per user
- The rules engine deciding when a human approval checkpoint is required before an agent action proceeds

**Status**: scaffolded in Milestone 4. Run instructions land with the code.
