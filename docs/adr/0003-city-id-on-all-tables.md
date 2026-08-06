# ADR-0003: city_id على كل الجداول

## الحالة
مقبول

## السياق
كل جدول يجب أن ينتمي لمدينة محددة منذ البداية لدعم نموذج المدن الأربع.

## القرار
كل جدول في قاعدة البيانات يحمل `city_id` من أول migration.

```sql
CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  telegram_support_group_id TEXT,
  telegram_escalation_group_id TEXT,
  telegram_unsubscribed_drivers_group_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## المدن الأربعة
1. جدة (Jeddah)
2. مكة (Makkah)
3. الرياض (Riyadh)
4. الطائف (Taif)

## ملاحظات
- هذه ليست multi-tenancy — هذه مدن运营 منفصلة.
- `tenancy` module (مستأجرين) يبقى هيكلاً فقط حالياً.
