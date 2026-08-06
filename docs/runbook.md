# Runbook — منصة وَصْلة

## أوامر التشغيل

### تطوير محلي

```bash
# تثبيت التبعيات
bun install

# تشغيل البوابة (Hono + Telegram Bots)
bun run dev:gateway

# تشغيل العمال
bun run dev:workers
```

### البناء والإنتاج

```bash
# بناء الحاوية
docker build -f docker/Dockerfile.gateway -t wasla-gateway .

# تشغيل الحاوية
docker run -p 3000:3000 --env-file .env wasla-gateway
```

## متغيرات البيئة المطلوبة

| المتغير | الوصف |
|---|---|
| `TELEGRAM_DRIVER_BOT_TOKEN` | رمز بوت السائق |
| `TELEGRAM_RIDER_BOT_TOKEN` | رمز بوت الراكب |
| `SUPABASE_URL` | رابط Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح خدمة Supabase |
| `UPSTASH_REDIS_REST_URL` | رابط Redis |
| `UPSTASH_REDIS_REST_TOKEN` | رمز Redis |
| `PORT` | منفذ HTTP |
| `TELEGRAM_WEBHOOK_SECRET` | سر Webhook |

## نقاط النهاية

- `/webhooks/telegram/driver` — Webhook بوت السائق
- `/webhooks/telegram/rider` — Webhook بوت الراكب
- `/health` — فحص الصحة

## الصيانة

### تفريغ السجلات

```bash
# سجلات Docker
docker logs wasla-gateway --tail=100
```
