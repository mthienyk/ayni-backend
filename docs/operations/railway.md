# Railway deployment

## Services

1. **API** — Node app, build `pnpm build`, start `pnpm start`
2. **Postgres** — Railway Postgres plugin

## Environment variables

Copy all vars from `.env.example` into Railway service settings. Required at minimum:

- `DATABASE_URL` (injected by Postgres plugin)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (32+ chars each)
- `API_BASE_URL` (public Railway URL)
- `MIN_SUPPORTED_APP_VERSION`, `INVITE_BASE_URL`

OAuth and R2 vars when those features are enabled.

## PostGIS

After first deploy, connect to Postgres and run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

If the initial migration already ran without PostGIS, run the command above then re-run migrations or verify geometry columns exist.

Check readiness: `GET /ready` should return `postgis: true`.

## Migrations

Run on deploy (build command or release phase):

```bash
pnpm db:migrate
```

## Cron jobs (Railway)

Configure cron services pointing to scripts in `src/jobs/` (to be added):

| Job | Schedule |
|-----|----------|
| zone-stats | `*/5 * * * *` |
| expire-magic-links | `0 * * * *` |
| refresh-token-prune | `0 3 * * *` |

## Backups

Enable daily Postgres backups on Railway. Verify point-in-time recovery availability on your plan before production.

## Fallback

If Railway Postgres lacks PostGIS on your plan, use [Neon](https://neon.tech) (PostGIS native) and set `DATABASE_URL` to the Neon connection string.
