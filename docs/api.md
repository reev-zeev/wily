# API Reference — منصة وَصْلة

## Webhooks (Telegram)

### POST /webhooks/telegram/driver
يستقبل تحديثات بوت السائق.

### POST /webhooks/telegram/rider
يستقبل تحديثات بوت الراكب.

## RPCs (PostgreSQL Functions)

### claim_ride
```sql
SELECT claim_ride(p_request_id UUID, p_driver_id UUID)
```
يدّعي سائق رحلة. يستخدم `SELECT ... FOR UPDATE SKIP LOCKED`.

### renew_subscription
```sql
SELECT renew_subscription(p_driver_id UUID, p_plan TEXT)
```
يُجدّد اشتراك السائق.

### record_attendance
```sql
SELECT record_attendance(p_driver_id UUID, p_is_available BOOLEAN)
```
يسجّل حالة توفر السائق.

## Platform Settings

| المفتاح | الوصف |
|---|---|
| `single_service_price` | سعر الاشتراك لخدمة واحدة |
| `dual_service_price` | سعر الاشتراك للخدمتين |
| `trial_days` | أيام التجربة المجانية |
| `search_radius_km` | نصف قطر البحث |
| `offer_timeout_seconds` | مهلة قبول العرض |
| `max_unsubscribed_drivers` | الحد الأقصى للسائقين غير المشتركين |
| `supported_languages` | اللغات المدعومة |
