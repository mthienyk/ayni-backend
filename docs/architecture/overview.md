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
  lib/email/{client,service,index}.ts
  lib/email/templates/{auth,notification,support,layout}.ts
  plugins/auth.ts
```

## Auth

### Providers

1. **Apple / Google** : l'app envoie un `idToken`, le serveur vérifie la signature, upsert `auth_identities` + `users`.
2. **Magic link** : email via Resend → lien vers `MAGIC_LINK_CALLBACK_URL` (app / site) → l'app **POST** le token à l'API. Pas de password.

### Magic link (sécurité)

| Mesure | Implémentation |
|--------|----------------|
| Token haute entropie | 48 chars (`nanoid`), jamais stocké en clair |
| Hash en DB | Argon2 sur le token complet |
| Lookup indexé | Préfixe SHA-256 (`lookup_hash`), pas de scan global |
| One-time | `consumed_at` + update conditionnel (anti race) |
| TTL court | 15 min (`MAGIC_LINK_TTL_MINUTES`) |
| Un seul lien actif / email | Anciens tokens invalidés à chaque demande |
| Anti prefetch email | Lien email → callback app (`joinayni.com/auth/magic-link`), **POST** `/verify` uniquement |
| Rate limits | 5 demandes / 15 min, 20 verify / 15 min / IP |
| Pas d'énumération | `POST /magic-link` renvoie toujours `{ sent: true }` |
| Comptes multi-provider | Même email OAuth ↔ magic link → même `users` row, identities liées |

Flow mobile :

```
Email → https://joinayni.com/auth/magic-link?token=…
App (universal link) → POST /v1/auth/magic-link/verify { token }
API → { accessToken, refreshToken, user }
```

Clients prévus : **web app** (page callback sur `joinayni.com`) + **Expo** (universal link + `expo-linking`). Même endpoint `POST /verify` pour les deux.

`GET /v1/auth/magic-link/verify` : redirect legacy vers le callback (ne consomme pas le token).

### Email (transactionnel)

Module `src/lib/email/` — client Resend centralisé, templates HTML+texte, tags Resend par catégorie.

| Méthode | Usage |
|---------|-------|
| `emailService.sendMagicLink` | Auth sign-in |
| `emailService.sendNotification` | Match, alertes produit |
| `emailService.sendSupportRequest` | Formulaire support (équipe + accusé user) |

Env : `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_SUPPORT_TO` (optionnel).
En dev sans clé Resend : emails loggés en console (`[dev:email]`).

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
| `POST /v1/auth/magic-link` | `{ email }` — rate limit 5/15min, toujours `{ sent: true }` |
| `POST /v1/auth/magic-link/verify` | `{ token, inviteCode? }` — rate limit 20/15min |
| `GET /v1/auth/magic-link/verify` | Redirect vers `MAGIC_LINK_CALLBACK_URL` (legacy, ne consomme pas) |
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

## Endpoints implémentés (MVP)

| Domaine | Routes clés |
|---------|-------------|
| Items | `POST /v1/items`, `GET /feed`, `PATCH /:id`, `POST /:id/publish`, photos presign/confirm |
| Swipes | `POST /v1/swipes`, `GET /v1/swipes` |
| Matches | `GET /v1/matches` |
| Chat | `GET/POST /v1/conversations/:id/messages?since=` |
| Zones | `GET /v1/zones/nearby?lat=&lng=` |

Dev sans R2 : upload local via `PUT /v1/dev-upload/:key`.

## Reporté post-MVP

- Table `invitations` (tracking jauge)
- `reports` / `blocks` (modération manuelle OK pour ~100 users)
- `trades`, `device_tokens`
- Passkeys, phone verification
- Feed swipe pré-calculé (scaling)
