# Roadmap backend

Document de suivi pour implémenter le plan lean. Mettre à jour les cases à chaque livraison.

## Phase 0 — Scaffold ✅

- [x] Fastify + TypeScript + Zod + OpenAPI (`/docs`)
- [x] Drizzle + Postgres/PostGIS (migration `0000_*`)
- [x] `GET /health`, `GET /ready`, `GET /v1/config`
- [x] Docker Compose local, `.env.example`
- [x] ESLint, Vitest, CI-ready scripts

## Phase 1 — Auth ✅

- [x] Tables `users`, `auth_identities`, `refresh_tokens`, `magic_link_tokens`
- [x] `POST /v1/auth/oauth` (Apple, Google)
- [x] `POST /v1/auth/magic-link` + verify (body + query pour liens email)
- [x] `POST /v1/auth/refresh`, `POST /v1/auth/logout`
- [x] `GET/PATCH /v1/auth/me`
- [x] `inviteCode` au signup → `invited_by_user_id`
- [x] Refresh tokens rotatifs, hash Argon2

**Hors scope (issue GitHub)** : phone verification, passkeys.

## Phase 2 — Items + médias

- [ ] `src/lib/storage/r2.ts` — presigned PUT
- [ ] Routes items CRUD (`draft` → `available`)
- [ ] `POST /v1/items/:id/photos/presign`
- [ ] `POST /v1/items/:id/photos/confirm` — IA sync 3-5s, `ai_metadata`
- [ ] Variantes image (thumbnail + full) dans R2
- [ ] `moderation_status` : auto-approve en dev, pending en prod

Fichiers à créer : `src/routes/items.ts`, `src/services/item.service.ts`, `src/lib/ai/enrich.ts`

## Phase 3 — Swipes + matches

- [ ] `POST /v1/swipes` — `{ item_id, direction }`
- [ ] `GET /v1/swipes` — historique paginé
- [ ] `src/services/match.service.ts` — réciprocité + `ON CONFLICT DO NOTHING`
- [ ] Test Vitest : création match concurrente → un seul row
- [ ] `GET /v1/matches` — liste matches actifs
- [ ] Feed swipe : items `available`, photos `approved`, hors déjà swipés

## Phase 4 — Chat + zones

- [ ] `GET/POST /v1/conversations/:id/messages` — polling `?since=`
- [ ] `GET /v1/zones/nearby` — jauge densité
- [ ] Job `zone-stats` (cron Railway)
- [ ] Jobs cleanup : magic links, refresh tokens

## Reporté post-MVP

- [ ] Table `invitations` (tracking jauge par invite)
- [ ] `reports`, `blocks`
- [ ] `trades`, `device_tokens`
- [ ] WebSocket chat
- [ ] BullMQ + Redis
- [ ] Feed swipe pré-calculé

## Ordre recommandé

```
Auth ✅ → Items/R2/IA → Swipes/Match → Chat/Zones
```

Estimation solo : ~1 semaine restante pour un beta swipeable après Phase 0-1.
