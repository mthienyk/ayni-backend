# Railway deployment

Project: **ayni-backend**  
Production URL: https://ayni-backend-production-d824.up.railway.app

## Services

1. **ayni-backend** — Node API (`pnpm build`, migrate + start via `railway.toml`)
2. **Postgres** — Railway Postgres plugin (standard, no PostGIS)

## Build (NODE_ENV + TypeScript)

Railway sets `NODE_ENV=production` during the build. With pnpm, that skips `devDependencies`, so `tsc` was missing and `pnpm build` failed.

**Fix in repo:**

- `typescript` and `@types/node` are in `dependencies` (required at build time).
- `railway.toml` runs install with `NODE_ENV=development` before `pnpm build` so eslint/vitest stay dev-only.

Verify locally with a production-like install:

```bash
rm -rf node_modules
NODE_ENV=production pnpm install --frozen-lockfile
pnpm build
```

### JWT / Docker build warnings

Railpack/Nixpacks may warn about `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` in build args or env. These are injected at **runtime** by Railway, not baked into the image. The warnings are harmless if secrets are set on the service, not in the Dockerfile.

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
| `INVITE_BASE_URL` | `https://joinayni.com/invite` |
| `MAGIC_LINK_CALLBACK_URL` | `https://joinayni.com/auth/magic-link` |
| `AUTO_APPROVE_PHOTOS` | `true` (beta) |
| `CORS_ORIGINS` | Public API URL (+ future web app origin) |
| `JWT_ACCESS_TTL` | `15m` (default) |
| `JWT_REFRESH_TTL` | `30d` (default) |
| `MAGIC_LINK_TTL_MINUTES` | `15` (default) |

Optional (enable when ready): `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `GOOGLE_CLIENT_ID`, R2 vars, `OPENAI_API_KEY`.

Email (Resend, domain `mail.joinayni.com`):

| Variable | Value |
|----------|-------|
| `RESEND_API_KEY` | Resend API key (`re_...`) |
| `EMAIL_FROM` | `noreply@mail.joinayni.com` |
| `EMAIL_REPLY_TO` | `support@joinayni.com` (optional, user-facing replies) |
| `EMAIL_SUPPORT_TO` | Inbox for support requests (defaults to `EMAIL_REPLY_TO`) |
| `MAGIC_LINK_CALLBACK_URL` | Web/Expo callback, e.g. `https://joinayni.com/auth/magic-link` |

**Ne pas** définir `DEV_AUTH_EXPOSE_TOKEN` en production.

Set via CLI:

```bash
railway link -p ayni-backend
railway service ayni-backend
railway variables set MAGIC_LINK_CALLBACK_URL='https://joinayni.com/auth/magic-link'
```

## Test auth prod (sans client)

```bash
pnpm dev:login you@gmail.com \
  --api https://ayni-backend-production-d824.up.railway.app \
  --token TOKEN_FROM_EMAIL \
  --name "Pseudo"
```

## Migrations

`railway.toml` runs `pnpm db:migrate:deploy && pnpm start` on **every deploy**.

Push to `main` → Railway rebuilds → migrations apply before the API starts.

`db:migrate:deploy` wraps `drizzle-kit migrate` with baseline retry when the DB already has tables but the migration journal is out of sync.

When you add a migration locally:

```bash
pnpm db:generate          # after schema change in src/db/schema/
pnpm db:migrate           # apply locally
git add src/db/migrations/
git commit && git push    # Railway applies 000N on next deploy
```

Manual / one-off:

```bash
pnpm db:migrate              # strict drizzle-kit only
pnpm db:migrate:deploy       # same as production start
railway run pnpm db:migrate:deploy
```

If migrate fails on redeploy (hash mismatch), check `drizzle.__drizzle_migrations` in Postgres and compare with tags in `src/db/migrations/meta/_journal.json`.

## PostGIS decision tree

The default Railway Postgres plugin **does not include PostGIS**. The current production schema uses `lat`/`lng` doubles and haversine distance in `zone.service.ts` so it runs on any Postgres.

```
Need PostGIS now?
├─ No (beta / fastest path) → keep lat/lng (current default)
│     • Works on Railway standard Postgres
│     • Good enough for circular zones + nearby lookup
│
├─ Yes, stay on Railway → Option A: Railway PostGIS template
│     1. Deploy https://railway.com/deploy/postgis (new Postgres service)
│     2. Point `DATABASE_URL` to the PostGIS instance
│     3. Fresh DB: run migrations (may need to drop old DB if switching)
│     4. Restore geometry schema: users.home_location, items.location, zones.polygon
│     5. Switch zone.service.ts to ST_Contains / ST_DWithin
│
└─ Yes, external DB → Option C: Neon or Supabase with PostGIS
      • API stays on Railway; only `DATABASE_URL` changes
      • Same schema migration steps as Option A
```

**Recommendation:** keep lat/lng until beta validates the product. When you need true polygons or PostGIS indexes, provision Railway PostGIS (Option A) or an external PostGIS host (Option C).

Local dev can still use PostGIS via `docker compose` (`postgis/postgis` image); the app schema matches standard Postgres for now.

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

## Deploy

```bash
railway link -p ayni-backend
railway service ayni-backend
railway up --detach
```
