-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 004: إصلاحات المدن + الموقع الحي + RPCs الحقيقية
-- 
-- الإصلاحات:
-- 1. إضافة city_slug لجدول cities (نص وصفي: jeddah, makkah, riyadh, taif)
-- 2. إضافة أعمدة الموقع الحي للسائقين (current_lat, current_lng)
-- 3. تنفيذ RPC functions الحقيقية مع FOR UPDATE SKIP LOCKED
-- 4. إضافة جدول unsubscribed_claims للتتبع
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. إضافة city_slug لجدول cities
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE cities ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS region TEXT;

-- تحديث slug للمدن الأربع الموجودة (حسب ترتيب الإدراج الأصلي)
UPDATE cities SET slug = 'jeddah', region = 'western' WHERE name_en = 'Jeddah';
UPDATE cities SET slug = 'makkah', region = 'western' WHERE name_en = 'Makkah';
UPDATE cities SET slug = 'riyadh', region = 'central' WHERE name_en = 'Riyadh';
UPDATE cities SET slug = 'taif', region = 'western' WHERE name_en = 'Taif';

-- إضافة قيد NOT NULL
ALTER TABLE cities ALTER COLUMN slug SET NOT NULL;

-- إضافة أعمدة Telegram groups إذا لم تكن موجودة
ALTER TABLE cities ADD COLUMN IF NOT EXISTS telegram_support_group_id BIGINT;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS telegram_escalation_group_id BIGINT;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS telegram_unsubscribed_drivers_group_id BIGINT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. إضافة أعمدة الموقع الحي للسائقين
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10, 8);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS current_lng DECIMAL(11, 8);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

-- فهرسة للموقع
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers(city_id, is_available, current_lat, current_lng) 
  WHERE current_lat IS NOT NULL AND current_lng IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. إضافة جدول unsubscribed_claims لتتبع الثلاثة بالتتابع
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS unsubscribed_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  driver_telegram_id BIGINT NOT NULL,
  slot_number INTEGER NOT NULL CHECK (slot_number >= 1 AND slot_number <= 3),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'rejected', 'expired', 'success')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(request_id, slot_number),
  UNIQUE(request_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_unsubscribed_claims_request ON unsubscribed_claims(request_id, status);
CREATE INDEX IF NOT EXISTS idx_unsubscribed_claims_driver ON unsubscribed_claims(driver_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RPC: claim_ride - قبول عرض في سباق ذري
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION claim_ride(
  p_request_id UUID,
  p_driver_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_request RECORD;
  v_offer_id UUID;
  v_timeout INTEGER;
BEGIN
  -- الحصول على إعدادات المهلة
  SELECT (value->>'seconds')::INTEGER INTO v_timeout
  FROM platform_settings 
  WHERE key = 'offer_timeout_seconds';
  
  IF v_timeout IS NULL THEN
    v_timeout := 45;
  END IF;

  -- قفل الطلب وتحديثه في عملية ذرية واحدة
  UPDATE requests
  SET 
    status = 'accepted',
    driver_id = p_driver_id,
    updated_at = now()
  WHERE 
    id = p_request_id 
    AND status = 'searching'
  RETURNING * INTO v_request;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REQUEST_NOT_AVAILABLE'
    );
  END IF;

  -- تحديث حالة السائق إلى غير متاح
  UPDATE drivers
  SET is_available = false, updated_at = now()
  WHERE id = p_driver_id;

  -- إلغاء العروض المعلقة الأخرى
  UPDATE offers
  SET status = 'cancelled'
  WHERE request_id = p_request_id AND driver_id != p_driver_id AND status = 'pending';

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'driver_id', p_driver_id
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC: record_attendance - تسجيل التوفر/عدم التوفر
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION record_attendance(
  p_driver_id UUID,
  p_is_available BOOLEAN,
  p_lat DECIMAL DEFAULT NULL,
  p_lng DECIMAL DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_driver RECORD;
  v_attendance_id UUID;
BEGIN
  -- قفل السائق
  SELECT * INTO v_driver
  FROM drivers
  WHERE id = p_driver_id
  FOR UPDATE;

  IF v_driver.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'DRIVER_NOT_FOUND');
  END IF;

  -- التحقق من الاشتراك
  IF p_is_available THEN
    IF v_driver.subscription_status NOT IN ('active', 'trial') THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'SUBSCRIPTION_REQUIRED',
        'subscription_status', v_driver.subscription_status
      );
    END IF;
    
    -- التحقق من انتهاء الفترة التجريبية
    IF v_driver.subscription_status = 'trial' AND v_driver.trial_ends_at < now() THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'TRIAL_EXPIRED'
      );
    END IF;
  END IF;

  -- تحديث السائق
  UPDATE drivers
  SET 
    is_available = p_is_available,
    current_lat = COALESCE(p_lat, current_lat),
    current_lng = COALESCE(p_lng, current_lng),
    location_updated_at = CASE WHEN p_lat IS NOT NULL OR p_lng IS NOT NULL THEN now() ELSE location_updated_at END,
    updated_at = now()
  WHERE id = p_driver_id;

  -- تسجيل في سجل التدقيق
  INSERT INTO audit_logs (city_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_driver.city_id,
    v_driver.user_id,
    CASE WHEN p_is_available THEN 'AVAILABILITY_ON' ELSE 'AVAILABILITY_OFF' END,
    'driver',
    p_driver_id,
    jsonb_build_object('lat', p_lat, 'lng', p_lng)
  );

  RETURN jsonb_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'is_available', p_is_available
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RPC: renew_subscription - تجديد الاشتراك
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION renew_subscription(
  p_driver_id UUID,
  p_plan TEXT,
  p_months INTEGER DEFAULT 1
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_driver RECORD;
  v_price INTEGER;
  v_ends_at TIMESTAMPTZ;
BEGIN
  -- تحديد السعر حسب الخطة
  IF p_plan = 'both' THEN
    SELECT (value->>'amount')::INTEGER INTO v_price
    FROM platform_settings WHERE key = 'dual_service_price';
  ELSE
    SELECT (value->>'amount')::INTEGER INTO v_price
    FROM platform_settings WHERE key = 'single_service_price';
  END IF;

  IF v_price IS NULL THEN
    v_price := CASE WHEN p_plan = 'both' THEN 400 ELSE 250 END;
  END IF;

  -- قفل السائق
  SELECT * INTO v_driver
  FROM drivers
  WHERE id = p_driver_id
  FOR UPDATE;

  IF v_driver.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'DRIVER_NOT_FOUND');
  END IF;

  -- حساب تاريخ انتهاء الاشتراك
  IF v_driver.subscription_ends_at > now() THEN
    v_ends_at := v_driver.subscription_ends_at + (p_months || ' months')::INTERVAL;
  ELSE
    v_ends_at := now() + (p_months || ' months')::INTERVAL;
  END IF;

  -- تحديث الاشتراك
  UPDATE drivers
  SET 
    subscription_status = 'active',
    subscription_plan = p_plan,
    subscription_ends_at = v_ends_at,
    trial_ends_at = NULL,
    updated_at = now()
  WHERE id = p_driver_id;

  -- تسجيل التدقيق
  INSERT INTO audit_logs (city_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_driver.city_id,
    v_driver.user_id,
    'SUBSCRIPTION_RENEWED',
    'driver',
    p_driver_id,
    jsonb_build_object('plan', p_plan, 'months', p_months, 'price', v_price, 'expires_at', v_ends_at)
  );

  RETURN jsonb_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'plan', p_plan,
    'price', v_price,
    'expires_at', v_ends_at
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. RPC: claim_unsubscribed_slot - حجز slot في آلية الثلاثة
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION claim_unsubscribed_slot(
  p_request_id UUID,
  p_driver_id UUID,
  p_driver_telegram_id BIGINT,
  p_timeout_seconds INTEGER DEFAULT 120
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_request RECORD;
  v_current_slots INTEGER;
  v_next_slot INTEGER;
  v_max_slots INTEGER;
  v_existing_claim RECORD;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- الحصول على الحد الأقصى من الإعدادات
  SELECT (value->>'count')::INTEGER INTO v_max_slots
  FROM platform_settings 
  WHERE key = 'max_unsubscribed_drivers';
  
  IF v_max_slots IS NULL THEN
    v_max_slots := 3;
  END IF;

  -- قفل الطلب
  SELECT * INTO v_request
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'REQUEST_NOT_FOUND');
  END IF;

  IF v_request.status NOT IN ('searching', 'offer_made') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'REQUEST_NOT_AVAILABLE',
      'status', v_request.status
    );
  END IF;

  -- التحقق من عدم وجود مطالبة سابقة من نفس السائق
  SELECT * INTO v_existing_claim
  FROM unsubscribed_claims
  WHERE request_id = p_request_id AND driver_id = p_driver_id;
  
  IF v_existing_claim.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_CLAIMED'
    );
  END IF;

  -- حساب عدد الـ slots المستخدمة
  SELECT COUNT(*), COALESCE(MAX(slot_number), 0)
  INTO v_current_slots, v_next_slot
  FROM unsubscribed_claims
  WHERE request_id = p_request_id AND status IN ('pending', 'contacted');

  IF v_current_slots >= v_max_slots THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALL_SLOTS_FILLED',
      'max_slots', v_max_slots
    );
  END IF;

  -- تحديد الـ slot التالي
  v_next_slot := v_next_slot + 1;
  v_expires_at := now() + (p_timeout_seconds || ' seconds')::INTERVAL;

  -- إدراج الـ claim
  INSERT INTO unsubscribed_claims (request_id, driver_id, driver_telegram_id, slot_number, status, expires_at)
  VALUES (p_request_id, p_driver_id, p_driver_telegram_id, v_next_slot, 'pending', v_expires_at);

  RETURN jsonb_build_object(
    'success', true,
    'slot_number', v_next_slot,
    'max_slots', v_max_slots,
    'expires_at', v_expires_at,
    'is_first', v_next_slot = 1
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. RPC: update_location - تحديث موقع السائق من Telegram
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_driver_location(
  p_driver_id UUID,
  p_lat DECIMAL,
  p_lng DECIMAL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_driver RECORD;
BEGIN
  -- التحقق من صحة الإحداثيات
  IF p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_COORDINATES');
  END IF;

  -- تحديث الموقع
  UPDATE drivers
  SET 
    current_lat = p_lat,
    current_lng = p_lng,
    location_updated_at = now(),
    updated_at = now()
  WHERE id = p_driver_id
  RETURNING * INTO v_driver;

  IF v_driver.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'DRIVER_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'lat', p_lat,
    'lng', p_lng
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. RPC: get_available_drivers_with_location - الحصول على السائقين المتاحين مع موقعهم
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_available_drivers_with_location(
  p_city_slug TEXT,
  p_lat DECIMAL,
  p_lng DECIMAL,
  p_radius_km DECIMAL DEFAULT 10,
  p_service_type TEXT,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  driver_id UUID,
  user_id UUID,
  current_lat DECIMAL,
  current_lng DECIMAL,
  distance_km DECIMAL,
  average_rating DECIMAL,
  capability TEXT
) LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id AS driver_id,
    d.user_id,
    d.current_lat,
    d.current_lng,
    CASE 
      WHEN d.current_lat IS NOT NULL AND d.current_lng IS NOT NULL
      THEN (
        6371 * acos(
          cos(radians(p_lat)) * cos(radians(d.current_lat)) *
          cos(radians(d.current_lng) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(d.current_lat))
        )
      )::DECIMAL
      ELSE 999999::DECIMAL
    END AS distance_km,
    d.average_rating,
    d.capability
  FROM drivers d
  INNER JOIN cities c ON d.city_id = c.id
  WHERE 
    c.slug = p_city_slug
    AND d.is_available = true
    AND d.subscription_status IN ('active', 'trial')
    AND d.current_lat IS NOT NULL
    AND d.current_lng IS NOT NULL
    AND CASE 
      WHEN p_service_type = 'ride' THEN d.capability IN ('rides', 'both')
      WHEN p_service_type = 'delivery' THEN d.capability IN ('delivery', 'both')
      ELSE true
    END
  ORDER BY 
    distance_km ASC,
    d.average_rating DESC
  LIMIT p_limit;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. إضافة RLS للجداول الجديدة
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE unsubscribed_claims ENABLE ROW LEVEL SECURITY;

COMMIT;
