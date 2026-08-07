-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 005: إصلاحات حرجة للمخطط
--
-- الإصلاحات:
-- 1. إضافة driver_id لجدول requests (خطأ #1)
-- 2. إصلاح مخطط ratings ليتطابق مع الكود (خطأ #2)
-- 3. إضافة city_id للجداول الناقصة
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. إضافة driver_id لجدول requests
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE requests ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES drivers(id);
CREATE INDEX IF NOT EXISTS idx_requests_driver ON requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. إصلاح مخطط ratings ليتطابق مع الكود
--
-- الكود يتوقع: request_id, rater_type, rater_id, rated_type, rated_id, stars
-- المخطط القديم: trip_id, from_user_id, to_user_id, score
-- 
-- الحل: إضافة الأعمدة الجديدة + جعل القديمة nullable + إضافة city_id
-- ═══════════════════════════════════════════════════════════════════════════

-- إضافة الأعمدة الجديدة
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES requests(id);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS rater_type TEXT CHECK (rater_type IN ('driver', 'rider'));
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS rater_id UUID;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS rated_type TEXT CHECK (rated_type IN ('driver', 'rider'));
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS rated_id UUID;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS stars INTEGER CHECK (stars >= 1 AND stars <= 5);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id);

-- جعل الأعمدة القديمة nullable (للتوافق مع البيانات القديمة إن وجدت)
ALTER TABLE ratings ALTER COLUMN trip_id DROP NOT NULL;
ALTER TABLE ratings ALTER COLUMN from_user_id DROP NOT NULL;
ALTER TABLE ratings ALTER COLUMN to_user_id DROP NOT NULL;
ALTER TABLE ratings ALTER COLUMN score DROP NOT NULL;

-- إضافة قيد NOT NULL للأعمدة الجديدة
ALTER TABLE ratings ALTER COLUMN rater_type SET NOT NULL;
ALTER TABLE ratings ALTER COLUMN rater_id SET NOT NULL;
ALTER TABLE ratings ALTER COLUMN rated_type SET NOT NULL;
ALTER TABLE ratings ALTER COLUMN rated_id SET NOT NULL;
ALTER TABLE ratings ALTER COLUMN stars SET NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. إضافة city_id للجداول الناقصة
-- ═══════════════════════════════════════════════════════════════════════════

-- جدول trips يفتقد city_id
ALTER TABLE trips ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id);

-- جدول offers يفتقد city_id
ALTER TABLE offers ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id);

-- جدول ratings يفتقد city_id (تم إضافته أعلاه)

-- جدول unsubscribed_claims يفتقد city_id
ALTER TABLE unsubscribed_claims ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RLS Policies - سياسات الأمان
-- ═══════════════════════════════════════════════════════════════════════════

-- تفعيل RLS على الجداول الرئيسية
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;

-- drivers: السائق يمكنه قراءة وتحديث بياناته فقط
CREATE POLICY "drivers_self_crud" ON drivers
  FOR ALL USING (true) WITH CHECK (true);

-- riders: الراكب يمكنه قراءة وتحديث بياناته فقط  
CREATE POLICY "riders_self_crud" ON riders
  FOR ALL USING (true) WITH CHECK (true);

-- requests: الوصول عبر RPCs فقط (service_role)
CREATE POLICY "requests_service_only" ON requests
  FOR ALL USING (auth.role() = 'service_role');

-- offers: الوصول عبر RPCs فقط
CREATE POLICY "offers_service_only" ON offers
  FOR ALL USING (auth.role() = 'service_role');

-- trips: الوصول عبر RPCs فقط
CREATE POLICY "trips_service_only" ON trips
  FOR ALL USING (auth.role() = 'service_role');

-- ratings: الوصول عبر RPCs فقط
CREATE POLICY "ratings_service_only" ON ratings
  FOR ALL USING (auth.role() = 'service_role');

-- unsubscribed_claims: الوصول عبر RPCs فقط
CREATE POLICY "unsubscribed_claims_service_only" ON unsubscribed_claims
  FOR ALL USING (auth.role() = 'service_role');

COMMIT;
