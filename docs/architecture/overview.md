# Architecture overview

> Suivi d'implémentation : [ROADMAP.md](../ROADMAP.md)

## Stack

- **Runtime** : Node 22, TypeScript strict
- **HTTP** : Fastify 5, Zod validation, OpenAPI via `fastify-type-provider-zod`
- **DB** : Postgres 16 + PostGIS, Drizzle ORM
- **Auth** : JWT access + refresh rotatif (hash Argon2 en DB)
- **Médias** : Cloudflare R2 + CDN (à brancher)

## Couches

```
route → service → Drizzle
```

Pas de couche repository. La logique métier vit dans `src/services/`.

## Arborescence

```
src/
  server.ts
  app.ts
  routes/auth.ts, routes/system.ts
  services/auth.service.ts
  db/schema/{auth,zones,items,swipes,geo}.ts
  db/migrations/
  lib/{config,crypto,errors}.ts
  lib/auth/oauth.ts
  lib/email/magic-link.ts
  plugins/auth.ts
```

## Auth

### Providers

1. **Apple / Google** : l'app envoie un `idToken`, le serveur vérifie la signature, upsert `auth_identities` + `users`.
2. **Magic link** : email → token one-time → JWT. Pas de password.

### Tables auth

- `users` : profil, `invite_code`, `invited_by_user_id`
- `auth_identities` : lien provider ↔ user (UNIQUE provider + subject)
- `refresh_tokens` : hash, expiration, révocation
- `magic_link_tokens` : one-time, TTL 15 min

### Signup avec invite

Body ou query `inviteCode` à l'inscription → `users.invited_by_user_id` renseigné. Pas de table `invitations` en MVP.

### Magic link + display name

Les users email n'ont pas de nom au signup. L'API renvoie `needsDisplayName: true` jusqu'à `PATCH /v1/auth/me`.

### Endpoints (implémentés)

| Route | Body / notes |
|-------|----------------|
| `POST /v1/auth/oauth` | `{ provider: "apple"\|"google", idToken, inviteCode? }` |
| `POST /v1/auth/magic-link` | `{ email }` — rate limit 5/15min |
| `POST /v1/auth/magic-link/verify` | `{ token, inviteCode? }` |
| `GET /v1/auth/magic-link/verify` | `?token=&inviteCode=` — pour liens email |
| `POST /v1/auth/refresh` | `{ refreshToken }` |
| `POST /v1/auth/logout` | `{ refreshToken }` |
| `GET /v1/auth/me` | Bearer JWT |
| `PATCH /v1/auth/me` | `{ displayName?, avatarUrl? }` |

Réponse auth : `{ accessToken, refreshToken, user }` avec `user.needsDisplayName`.

## Schéma domaine (MVP)

| Table | Rôle |
|-------|------|
| `zones` | Mailles geo, jauge densité |
| `items` | Objets à troquer, `ai_metadata` jsonb |
| `item_photos` | URLs R2, `moderation_status` (pending/approved/rejected) |
| `swipes` | like/pass, UNIQUE (swiper, item) |
| `matches` | Double désir, UNIQUE (item_low_id, item_high_id) |
| `conversations` / `messages` | Chat post-match |

Soft delete : `deleted_at` nullable sur les entités principales.

## Matching (double désir)

Quand user A like l'item de B :

1. Insert swipe (idempotent).
2. Chercher si B a déjà liké un item de A.
3. Si oui : `INSERT match ON CONFLICT DO NOTHING` sur `(item_low_id, item_high_id)`.
4. Créer conversation, passer items en `matched`.

**Race condition** : la contrainte UNIQUE + `ON CONFLICT DO NOTHING` garantit un seul match par paire d'items même si deux swipes arrivent simultanément.

Règle ambiguïté : plusieurs items par user → on matche sur la première paire réciproque trouvée.

## IA enrichment (à implémenter)

Flow prévu **sync** au `POST .../photos/confirm` :

1. Upload R2 via presigned URL
2. Appel vision LLM (~3-5s) → titre, fourchette prix, tags
3. Item reste `draft` jusqu'à publish explicite
4. Timeout 8s → champs vides, user remplit manuellement

## Modération photos

`item_photos.moderation_status` default `pending`. Feed : uniquement photos `approved`. En dev, auto-approve possible. Prod : modération manuelle ou Cloudflare NSFW scan plus tard.

## Chat

MVP : **polling** `GET /v1/conversations/:id/messages?since=` toutes les ~3s. Pas de WebSocket J1.

## Jobs

Cron Railway + polling DB (`SELECT FOR UPDATE SKIP LOCKED`). Pas de Redis/BullMQ tant que le volume ne le justifie pas.

| Job | Fréquence |
|-----|-----------|
| zone-stats | 5 min |
| expire-magic-links | hourly |
| refresh-token-prune | daily |

## Config app

`GET /v1/config` → `minSupportedVersion`, `inviteBaseUrl`. Force update côté mobile si version trop ancienne.

## Reporté post-MVP

- Table `invitations` (tracking jauge)
- `reports` / `blocks` (modération manuelle OK pour ~100 users)
- `trades`, `device_tokens`
- Passkeys, phone verification
- Feed swipe pré-calculé (scaling)
