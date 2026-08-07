# ADR-0004: Migration Naming Convention

## السياق
عند مراجعة ملفات migrations في `supabase/migrations/`، لوحظ وجود فجوة في الترقيم:
- `001_initial_schema.sql`
- (لا يوجد 002 أو 003)
- `004_fix_cities_and_location.sql`
- `005_fix_critical_schema.sql`
- `006_fix_rls_and_city_id.sql`

## القرار
نستخدم الترقيم التسلسلي العادي (001, 002, 003...) مع ملاحظة:
- الملفات المفقودة (002, 003) تم حذفها لأنها كانت contain duplicate/incorrect RPC stubs
- تم توثيق ذلك في commit `1034e22 chore: Remove old RPC stubs migration (002)`

## الحالة
مقبول - لا حاجة لإجراء تصحيحي
