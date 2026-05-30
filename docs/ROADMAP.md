# Roadmap backend

Document de suivi pour implémenter le plan lean. Mettre à jour les cases à chaque livraison.

## Phase 0 — Scaffold ✅

- [x] Fastify + TypeScript + Zod + OpenAPI (`/docs`)
- [x] Drizzle + Postgres/PostGIS (migration `0000_*`)
- [x] `GET /health`, `GET /ready`, `GET /v1/config`
- [x] Docker Compose local, `.env.example`
- [x] ESLint, Vitest, CI GitHub Actions

## Phase 1 — Auth ✅

- [x] Tables `users`, `auth_identities`, `refresh_tokens`, `magic_link_tokens`
- [x] Migration `0001` — `lookup_hash` magic link (lookup indexé)
- [x] `POST /v1/auth/oauth` (Apple, Google) + account linking par email
- [x] `POST /v1/auth/magic-link` + verify (POST only pour consommer le token)
- [x] `GET /v1/auth/magic-link/verify` — redirect vers callback (legacy, ne consomme pas)
- [x] `POST /v1/auth/refresh`, `POST /v1/auth/logout`
- [x] `GET/PATCH /v1/auth/me`
- [x] Email Resend (`mail.joinayni.com`) + module transactionnel
- [x] Refresh tokens rotatifs, hash Argon2
- [x] JWT gatekeeping : user supprimé / suspendu rejeté sur routes protégées
- [x] Scripts dev : `pnpm dev:login`, `pnpm bootstrap:session`
- [x] `inviteCode` au signup → `invited_by_user_id`

**Hors scope (issue GitHub)** : phone verification, passkeys.

## Phase 2 — Items + médias ✅

- [x] `src/lib/storage/r2.ts` — presigned PUT (+ dev local fallback)
- [x] Routes items CRUD (`draft` → `available`)
- [x] `POST /v1/items/:id/photos/presign`
- [x] `POST /v1/items/:id/photos/confirm` — IA sync, `ai_metadata`
- [x] Variantes image (thumbnail + full) via sharp
- [x] `moderation_status` : auto-approve si `AUTO_APPROVE_PHOTOS=true`

## Phase 3 — Swipes + matches ✅

- [x] `POST /v1/swipes` — `{ itemId, direction }`
- [x] `GET /v1/swipes` — historique paginé
- [x] `MatchService` — réciprocité + `ON CONFLICT DO NOTHING`
- [x] Test Vitest paire canonique + contrat duplicate prevention
- [x] `GET /v1/matches` — liste matches actifs
- [x] `GET /v1/items/feed` — feed swipe

## Phase 4 — Chat + zones ✅

- [x] `GET/POST /v1/conversations/:id/messages` — polling `?since=`
- [x] `GET /v1/conversations/by-match/:matchId`
- [x] `GET /v1/zones/nearby` — jauge densité
- [x] Jobs : `pnpm job zone-stats|expire-magic-links|refresh-token-prune`

## Reporté post-MVP

- [ ] Table `invitations` (tracking jauge par invite)
- [ ] `reports`, `blocks`
- [ ] `trades`, `device_tokens`
- [ ] WebSocket chat
- [ ] BullMQ + Redis
- [ ] Feed swipe pré-calculé

## Ordre recommandé

```
Auth ✅ → Items/R2/IA ✅ → Swipes/Match ✅ → Chat/Zones ✅
```

Prochaine étape produit : **web app + Expo** (page callback magic link) + beta 11e.
