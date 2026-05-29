# Documentation Ayni Backend

## Par où commencer

1. [operations/local-dev.md](operations/local-dev.md) — lancer l'API en local
2. [architecture/overview.md](architecture/overview.md) — stack, schéma, règles métier
3. [ROADMAP.md](ROADMAP.md) — **suivi du plan** (phases, cases à cocher)

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

## API (implémenté aujourd'hui)

| Méthode | Route | Auth |
|---------|-------|------|
| GET | `/health` | — |
| GET | `/ready` | — |
| GET | `/v1/config` | — |
| POST | `/v1/auth/oauth` | — |
| POST | `/v1/auth/magic-link` | — |
| POST | `/v1/auth/magic-link/verify` | — |
| GET | `/v1/auth/magic-link/verify` | — |
| POST | `/v1/auth/refresh` | — |
| POST | `/v1/auth/logout` | — |
| GET | `/v1/auth/me` | JWT |
| PATCH | `/v1/auth/me` | JWT |

OpenAPI interactif : `/docs` (généré depuis Zod, pas de YAML manuel).

## Structure code

```
src/
  server.ts          # entrypoint
  app.ts             # Fastify bootstrap
  routes/            # HTTP + schemas Zod
  services/          # logique métier + Drizzle
  db/schema/         # tables Drizzle
  db/migrations/     # SQL versionné
  lib/               # config, auth, crypto, email
  plugins/           # JWT guard
```

Convention : **route → service → Drizzle** (pas de repository layer).

## Backlog produit (issues, pas doc)

- Auth tiers : vérification téléphone avant premier match, passkeys v2
