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

Le lien dans l'email pointe vers `MAGIC_LINK_CALLBACK_URL` (défaut : `https://joinayni.com/auth/magic-link?token=…`). L'app mobile intercepte ce universal link et **POST** le token à `/v1/auth/magic-link/verify`. En dev local, copie le token depuis les logs et POST directement.

Profil (remplacer `ACCESS_TOKEN`) :

```bash
curl http://localhost:3000/v1/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

## Magic link (dev)

Sans `RESEND_API_KEY`, l'email magic link est loggé dans la console du serveur :

```
[dev:email] category=auth to=test@example.com subject="Connexion à Ayni"
Bonjour,
...
```

Avec `RESEND_API_KEY` en local, l'email part via Resend depuis `noreply@mail.joinayni.com`.

## Database

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | New migration after schema change |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Drizzle Studio GUI |

Connection string (default): `postgresql://ayni:ayni@localhost:5432/ayni`

PostGIS : optionnel en local (`postgis/postgis` dans docker-compose). En prod Railway, le schéma utilise `lat`/`lng` — voir [operations/railway.md](operations/railway.md).

## Tests

```bash
pnpm test
pnpm lint
pnpm typecheck
```
