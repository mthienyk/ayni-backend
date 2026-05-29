# Cloudflare R2 (photos)

## Why R2

Zero egress fees. Critical for a photo-heavy swipe feed at scale.

## Setup

1. Create R2 bucket in Cloudflare dashboard (e.g. `ayni-photos`)
2. Create API token with Object Read & Write
3. Set env vars:

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=ayni-photos
R2_PUBLIC_BASE_URL=https://cdn.ayni.app
```

## CDN

1. Connect custom domain to bucket (Cloudflare CDN)
2. Set `R2_PUBLIC_BASE_URL` to CDN URL
3. Never serve images from Railway directly

## Upload flow (planned)

1. `POST /v1/items/:id/photos/presign` → signed PUT URL
2. Client uploads directly to R2
3. `POST /v1/items/:id/photos/confirm` → register CDN URL, generate thumbnail variant

## CORS

Allow PUT from mobile app origins on the bucket:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"]
  }
]
```

Tighten origins in production.

## Image variants (MVP)

Generate 2 sizes at upload time (thumbnail + full), store both in R2. Cloudflare Images optional later.

## Moderation

`item_photos.moderation_status` starts as `pending`. Cloudflare NSFW detection can be wired later without schema change.
