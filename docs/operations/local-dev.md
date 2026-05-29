# Local development

## Prerequisites

- Node 22+
- pnpm
- Docker (Postgres + PostGIS)

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm dev
```

## Verify

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
curl http://localhost:3000/v1/config
```

OpenAPI UI: http://localhost:3000/docs

## Test auth (curl)

Config :

```bash
curl http://localhost:3000/v1/config
```

Magic link (sans Resend, lien dans les logs serveur) :

```bash
curl -X POST http://localhost:3000/v1/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
# puis copier le token depuis les logs et :
curl -X POST http://localhost:3000/v1/auth/magic-link/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"TOKEN_ICI"}'
```

Profil (remplacer `ACCESS_TOKEN`) :

```bash
curl http://localhost:3000/v1/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

## Magic link (dev)

Sans `RESEND_API_KEY`, le lien magic est loggé dans la console du serveur :

```
[dev] Magic link for user@example.com: http://localhost:3000/v1/auth/magic-link/verify?token=...
```

## Database

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | New migration after schema change |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Drizzle Studio GUI |

Connection string (default): `postgresql://ayni:ayni@localhost:5432/ayni`

PostGIS is enabled in migration `0000_*` via `CREATE EXTENSION postgis`.

## Tests

```bash
pnpm test
pnpm lint
pnpm typecheck
```
