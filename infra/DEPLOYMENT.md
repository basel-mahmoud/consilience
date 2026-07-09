# Deploying the backend (going live end-to-end)

The web app is on Vercel already. This makes the three backend services public so the deployed site runs the full pipeline (auth → engine → mesh → live trace), instead of web-only mode.

Everything here is prepared: Dockerfiles build and the full stack is verified in containers (`infra/docker-compose.full.yml`), and Fly.io configs exist per service. The steps below are what remain — the ones that need an account and a card.

## What needs you (account / payment)

1. **A Fly.io account** with a payment method — `fly deploy` won't run three machines without one. (Alternatives: Railway, Render + a worker plan, or a single small VM running `docker-compose.full.yml`.)
2. **A managed broker** — [CloudAMQP](https://www.cloudamqp.com) "Little Lemur" is free; create an instance and copy its AMQP URL.
3. **A dedicated Gemini key** — a fresh [AI Studio](https://aistudio.google.com/apikey) key works for a demo (~free-tier limits); a **paid** key (billing enabled) is needed for sustained use.

## What I do once you've authorized the above

```bash
brew install flyctl && fly auth login          # one-time

# Managed Postgres is already Neon; broker is CloudAMQP. Then per app:
cd services/gateway && fly launch --copy-config --no-deploy
fly secrets set \
  DATABASE_URL="postgres://…neon…" \
  RABBITMQ_URL="amqps://…cloudamqp…" \
  Clerk__Authority="https://<your-clerk>.clerk.accounts.dev" \
  Cors__AllowedOrigins__0="https://consilience-one.vercel.app"
fly deploy

cd ../mesh && fly launch --copy-config --no-deploy
fly secrets set DATABASE_URL="…" RABBITMQ_URL="…" GEMINI_API_KEY="…"
fly deploy

cd ../engine && fly launch --copy-config --no-deploy
fly secrets set DATABASE_URL="…" RABBITMQ_URL="…"
fly deploy
```

Then point the frontend at the live gateway and redeploy:

```bash
vercel env add NEXT_PUBLIC_GATEWAY_URL production   # → https://consilience-gateway.fly.dev
vercel --prod
```

## Verify live

1. `curl https://consilience-gateway.fly.dev/health` → `{"status":"ok"}`
2. Sign in on the Vercel site; the dashboard footer shows **gateway session verified**.
3. Start a run and watch the live trace stream in — the full pipeline, in production.

## Alternative: one small VM (cheapest)

A single 1–2 GB VM (Fly, Hetzner, a DigitalOcean droplet) can run everything with the broker included:

```bash
# on the VM, with the repo checked out and a .env in place
docker compose -f infra/docker-compose.full.yml --env-file .env up -d
```

Expose the gateway's port behind TLS (Caddy/Traefik) and set `NEXT_PUBLIC_GATEWAY_URL` to it. This avoids a separate managed broker.
