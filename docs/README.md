# Documentation Ayni Backend

## Par où commencer

1. [operations/local-dev.md](operations/local-dev.md) — lancer l'API en local
2. [architecture/overview.md](architecture/overview.md) — stack, schéma, règles métier
3. [ROADMAP.md](ROADMAP.md) — suivi du plan (phases complétées)

## Fichiers

| Fichier | Contenu |
|---------|---------|
| [ROADMAP.md](ROADMAP.md) | Plan d'implémentation, statut par phase |
| [architecture/overview.md](architecture/overview.md) | Stack, auth, matching, IA, jobs |
| [operations/local-dev.md](operations/local-dev.md) | Dev local + exemples curl |
| [operations/railway.md](operations/railway.md) | Deploy Railway |
| [operations/cloudflare-r2.md](operations/cloudflare-r2.md) | Stockage photos |

## Produit

Vision produit : [concept.md](../concept.md) à la racine du repo.

## API (implémenté)

| Domaine | Routes |
|---------|--------|
| System | `GET /health`, `GET /ready`, `GET /v1/config` |
| Auth | `POST /v1/auth/oauth`, magic-link, refresh, logout, `GET/PATCH /me` |
| Items | `POST /v1/items`, `GET /feed`, `PATCH /:id`, `POST /:id/publish`, photos presign/confirm |
| Swipes | `POST /v1/swipes`, `GET /v1/swipes` |
| Matches | `GET /v1/matches` |
| Chat | `GET/POST /v1/conversations/:id/messages`, `GET /by-match/:matchId` |
| Zones | `GET /v1/zones/nearby?lat=&lng=` |

OpenAPI interactif : `/docs`

## Jobs cron (Railway)

```bash
pnpm job zone-stats
pnpm job expire-magic-links
pnpm job refresh-token-prune
```

## Structure code

```
src/
  routes/            # HTTP + schemas Zod
  services/          # logique métier + Drizzle
  lib/storage/r2.ts  # R2 + fallback local dev
  lib/ai/enrich.ts   # enrichissement vision sync
  jobs/run.ts        # entrypoint cron
```

Convention : **route → service → Drizzle**

## Backlog produit (issues, pas doc)

- Auth tiers : vérification téléphone avant premier match, passkeys v2
