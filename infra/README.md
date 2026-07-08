# Infra

Local development topology and deployment documentation.

- `docker-compose.yml` (lands in Milestone 2, first broker consumer): RabbitMQ + the backend services. Postgres is Neon-hosted even in dev — branch databases give isolated dev/test schemas.
- Deployment: `apps/web` deploys to Vercel on every milestone push. Backend hosting is documented per-service as each comes online; until then each service README carries its run instructions.
- Rollback: Vercel instant rollback for the frontend; backend services are containerized so a rollback is a redeploy of the previous tag. Formalized in the Milestone 6 hardening pass.
