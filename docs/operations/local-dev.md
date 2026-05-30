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

## Test auth (sans client web / Expo)

Prérequis : `DEV_AUTH_EXPOSE_TOKEN=true` dans `.env` (local uniquement, jamais sur Railway).

### Local (recommandé)

```bash
pnpm dev   # terminal 1
pnpm dev:login test@example.com --name "Dev User"   # terminal 2
```

Affiche `accessToken`, `refreshToken`, sauvegarde `.ayni-session.json`.

Tester une route protégée :

```bash
curl http://localhost:3000/v1/auth/me \
  -H "Authorization: Bearer $(node -pe 'JSON.parse(require("fs").readFileSync(".ayni-session.json")).accessToken')"
```

### Production Railway (email réel)

```bash
# 1. Demander le lien (email reçu sur ta boîte)
curl -X POST https://ayni-backend-production-d824.up.railway.app/v1/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"you@gmail.com"}'

# 2. Copier le token=... depuis l'URL de l'email, puis :
pnpm dev:login you@gmail.com \
  --api https://ayni-backend-production-d824.up.railway.app \
  --token TOKEN_ICI \
  --name "Ton pseudo"
```

Sans client, le token est dans l'URL du mail (`MAGIC_LINK_CALLBACK_URL?token=...`). Quand la web app existera, cette page fera le POST verify automatiquement.

### Logs serveur local

Même avec Resend activé, `pnpm dev` loggue une commande curl prête à l'emploi :

```
[dev:auth] Magic link for test@example.com
  curl -X POST http://localhost:3000/v1/auth/magic-link/verify ...
```

## Test auth (curl manuel)

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

Le lien dans l'email pointe vers `MAGIC_LINK_CALLBACK_URL` (défaut : `https://joinayni.com/auth/magic-link?token=…`). La future web app / Expo intercepte ce lien et **POST** le token à `/v1/auth/magic-link/verify`.

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
| `pnpm db:migrate:deploy` | Same as Railway production start |
| `pnpm dev:login` | Auth sans client (voir ci-dessus) |
| `pnpm bootstrap:session` | Ops : session via accès DB direct |
| `pnpm db:studio` | Drizzle Studio GUI |

Connection string (default): `postgresql://ayni:ayni@localhost:5432/ayni`

PostGIS : optionnel en local (`postgis/postgis` dans docker-compose). En prod Railway, le schéma utilise `lat`/`lng` — voir [operations/railway.md](operations/railway.md).

## Tests

```bash
pnpm test
pnpm lint
pnpm typecheck
```
