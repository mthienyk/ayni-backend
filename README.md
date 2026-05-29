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
| `pnpm db:migrate` | Apply migrations |
| `pnpm test` | Run tests |
| `pnpm lint` | ESLint |

## Documentation

- [docs/README.md](docs/README.md) — index
- [docs/ROADMAP.md](docs/ROADMAP.md) — **plan de suivi** (phases, statut)
- [docs/architecture/overview.md](docs/architecture/overview.md) — architecture

## Stack

Fastify + TypeScript + Drizzle + Postgres/PostGIS. Auth: Apple, Google, magic link (JWT). Media: Cloudflare R2.

## Status

- [x] Scaffold, health, config, OpenAPI
- [x] Auth (OAuth, magic link, JWT refresh)
- [x] Database schema (users, items, swipes, matches, …)
- [ ] Items + R2 upload + IA enrichment
- [ ] Swipes + match detection
- [ ] Chat (polling) + zones
