-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 006: إصلاح RLS + city_id الإدراج
--
-- الإصلاحات:
-- 1. FIX RLS: استبدال policies الخاطئة على drivers/riders
-- 2. إضافة city_id لجميع عمليات الإدراج
-- 3. إضافة RLS للجداول المتبقية
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. FIX RLS: استبدال policies الخاطئة
--
-- المشكلة: USING (true) WITH CHECK (true) يسمح لأي شخص بقراءة/تعديل كل البيانات
-- الحل: service_role فقط (وصول الخادم فقط حالياً)
-- ═══════════════════════════════════════════════════════════════════════════

-- حذف السياسات الخاطئة
DROP POLICY IF EXISTS "drivers_self_crud" ON drivers;
DROP POLICY IF EXISTS "riders_self_crud" ON riders;

-- إنشاء سياسات صحيحة (service_role فقط)
CREATE POLICY "drivers_service_only" ON drivers
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "riders_service_only" ON riders
  FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RLS للجداول المتبقية
-- ═══════════════════════════════════════════════════════════════════════════

-- platform_settings: إعدادات المنصة (service_role فقط)
ALTER TABLE IF EXISTS platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_settings_service_only" ON platform_settings;
CREATE POLICY "platform_settings_service_only" ON platform_settings
  FOR ALL USING (auth.role() = 'service_role');

-- cities: بيانات المدن (service_role فقط)
ALTER TABLE IF EXISTS cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cities_service_only" ON cities;
CREATE POLICY "cities_service_only" ON cities
  FOR ALL USING (auth.role() = 'service_role');

-- users: بيانات المستخدمين (service_role فقط)
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_service_only" ON users;
CREATE POLICY "users_service_only" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- audit_logs: سجلات التدقيق (service_role فقط)
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_service_only" ON audit_logs;
CREATE POLICY "audit_logs_service_only" ON audit_logs
  FOR ALL USING (auth.role() = 'service_role');

-- disputes: النزاعات (service_role فقط)
ALTER TABLE IF EXISTS disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "disputes_service_only" ON disputes;
CREATE POLICY "disputes_service_only" ON disputes
  FOR ALL USING (auth.role() = 'service_role');

-- unsubscribed_claims: (قد أُضيفت سابقاً)
ALTER TABLE IF EXISTS unsubscribed_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unsubscribed_claims_service_only" ON unsubscribed_claims;
CREATE POLICY "unsubscribed_claims_service_only" ON unsubscribed_claims
  FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. إضافة فهارس للـ city_id الجديد
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_trips_city ON trips(city_id);
CREATE INDEX IF NOT EXISTS idx_offers_city ON offers(city_id);
CREATE INDEX IF NOT EXISTS idx_ratings_city ON ratings(city_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribed_claims_city ON unsubscribed_claims(city_id);

COMMIT;
