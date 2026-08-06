# وصلة (Wasla) - منصة النقل والتوصيل

منصة خدمات النقل والتوصيل للمدن الأربع: جدة، مكة، الرياض، الطائف.

## التقنيات

- **Language**: TypeScript على Bun
- **Framework**: Hono (HTTP server) + grammY (Telegram bots)
- **Database**: PostgreSQL via Supabase
- **Cache**: Upstash Redis

## الهيكل

```
apps/
├── gateway/          # خادم HTTP + Telegram bots
├── workers/          # عمال خلفيون
└── admin-dashboard/  # لوحة الإدارة

packages/
├── domain/          # منطق الأعمال
├── application/     # حالات الاستخدام
├── infrastructure/  # تكاملات خارجية
└── shared/          # utilities مشتركة
```

## التطوير

```bash
# تثبيت dependencies
bun install

# TypeScript check
bun run typecheck

# Lint
bun run lint

# Tests
bun test

# E2E Tests (يتطلب Supabase)
SUPABASE_URL=<url> SUPABASE_SERVICE_KEY=<key> bun test tests/integration/
```

## النشر

```bash
# Build Docker images
docker compose build

# Production
docker compose -f docker-compose.prod.yml up -d
```

## Commits

| # | Commit | الوصف |
|---|--------|-------|
| 1 | foundation | أمر 1: أرضية المليار مستخدم |
| 2 | C2 | بوتات السائق والراكب + محرك المطابقة |
| 3 | C3 | State machine + webhooks + قروب غير المشتركين |
| 4 | C4 | نظام التقييم + i18n |
| 5 | C5 | إصلاحات critical |

---

*منصة وصلة - ربطنا ببعض*