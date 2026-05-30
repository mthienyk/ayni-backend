# Railway deployment

Project: **ayni-backend**  
Production URL: https://ayni-backend-production-d824.up.railway.app

## Services

1. **ayni-backend** — Node API (`pnpm build`, migrate + start via `railway.toml`)
2. **Postgres** — Railway Postgres plugin

## Environment variables (service `ayni-backend`)

Required:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | `production` |
| `API_BASE_URL` | Public Railway URL (ex. `https://ayni-backend-production-d824.up.railway.app`) |
| `JWT_ACCESS_SECRET` | 32+ chars random |
| `JWT_REFRESH_SECRET` | 32+ chars random |
| `MIN_SUPPORTED_APP_VERSION` | `1.0.0` |
| `INVITE_BASE_URL` | `https://ayni.app/invite` |
| `AUTO_APPROVE_PHOTOS` | `true` (beta) |
| `CORS_ORIGINS` | Public API URL |

Optional (enable when ready): `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, R2 vars, `OPENAI_API_KEY`.

Set via CLI:

```bash
railway link -p ayni-backend
railway service ayni-backend
railway variables set DATABASE_URL='${{Postgres.DATABASE_URL}}' API_BASE_URL=https://...
```

## Migrations

`railway.toml` runs `pnpm db:migrate && pnpm start` on each deploy.

Migrations are also applied manually when needed:

```bash
railway run pnpm db:migrate
```

If migrate fails on redeploy (hash mismatch), check `drizzle.__drizzle_migrations` in Postgres.

## PostGIS

The default Railway Postgres plugin **does not include PostGIS**. The MVP schema uses `lat`/`lng` columns instead of geometry types so it runs on any Postgres.

For full PostGIS later, provision a [Railway PostGIS template](https://railway.com/deploy/postgis) and point `DATABASE_URL` to it, then restore geometry columns in the schema.

Local dev with PostGIS remains optional via `docker compose` (`postgis/postgis` image).

## Health checks

```bash
curl https://ayni-backend-production-d824.up.railway.app/health
curl https://ayni-backend-production-d824.up.railway.app/ready
curl https://ayni-backend-production-d824.up.railway.app/v1/config
```

## Cron jobs

Separate Railway cron services (or GitHub Actions):

```bash
pnpm job zone-stats
pnpm job expire-magic-links
pnpm job refresh-token-prune
```

| Job | Schedule |
|-----|----------|
| zone-stats | `*/5 * * * *` |
| expire-magic-links | `0 * * * *` |
| refresh-token-prune | `0 3 * * *` |

## Backups

Enable daily Postgres backups on Railway. Verify point-in-time recovery on your plan before production.
