# Ayni Backend

API backend for [Ayni](concept.md): local barter between strangers.

## Quickstart

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm dev
```

API: `http://localhost:3000`  
OpenAPI UI: `http://localhost:3000/docs`

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` | Compile TypeScript |
| `pnpm start` | Run production build |
| `pnpm db:generate` | Generate migration from schema changes |
| `pnpm db:migrate` | Apply migrations (local) |
| `pnpm db:migrate:deploy` | Same command as Railway production start |
| `pnpm dev:login <email>` | Auth sans client (local ou prod via `--api`) |
| `pnpm bootstrap:session` | Ops bootstrap (accès DB requis) |
| `pnpm test` | Run tests |
| `pnpm lint` | ESLint |

## Documentation

- [docs/README.md](docs/README.md) — index
- [docs/ROADMAP.md](docs/ROADMAP.md) — **plan de suivi** (phases, statut)
- [docs/architecture/overview.md](docs/architecture/overview.md) — architecture

## Stack

Fastify + TypeScript + Drizzle + Postgres/PostGIS. Auth: Apple, Google, magic link (JWT). Media: Cloudflare R2.

## Deploy

Push to `main` → GitHub CI (lint, test, migrations) → Railway auto-deploy → `db:migrate:deploy` then API start. See [docs/operations/railway.md](docs/operations/railway.md).

Auth sans client : `pnpm dev:login test@example.com` — voir [docs/operations/local-dev.md](docs/operations/local-dev.md).

## Status

- [x] Scaffold, health, config, OpenAPI, CI
- [x] Auth (OAuth, magic link, JWT refresh, Resend email)
- [x] Database schema + migrations
- [x] Items + R2 upload + IA enrichment
- [x] Swipes + match detection
- [x] Chat (polling) + zones + cron jobs
- [ ] Web app + Expo (clients — prochaine étape produit)
