-- الغرض: مخطط قاعدة البيانات الأولي لمنصة وَصْلة
-- الحالة: هيكل فقط — لا تنفيذ. لا تُضِف منطقاً هنا قبل أمر تفعيل صريح.
-- المدن: جدة، مكة، الرياض، الطائف

-- 1. جدول المدن
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

-- إدراج المدن الأربع
INSERT INTO cities (name_ar, name_en) VALUES
  ('جدة', 'Jeddah'),
  ('مكة المكرمة', 'Makkah'),
  ('الرياض', 'Riyadh'),
  ('الطائف', 'Taif');

-- 2. جدول إعدادات المنصة
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- إعدادات افتراضية
INSERT INTO platform_settings (key, value, description) VALUES
  ('single_service_price', '{"amount": 250, "currency": "SAR"}', 'سعر الاشتراك لخدمة واحدة'),
  ('dual_service_price', '{"amount": 400, "currency": "SAR"}', 'سعر الاشتراك للخدمتين'),
  ('trial_days', '{"days": 30}', 'أيام التجربة المجانية'),
  ('search_radius_km', '{"km": 10}', 'نصف قطر البحث'),
  ('offer_timeout_seconds', '{"seconds": 45}', 'مهلة قبول العرض'),
  ('max_unsubscribed_drivers', '{"count": 3}', 'الحد الأقصى للسائقين'),
  ('matching_weights', '{"distance": 0.6, "rating": 0.4}', 'أوزان المطابقة'),
  ('supported_languages', '{"languages": ["ar", "en", "ur"]}', 'اللغات المدعومة');

-- 3. جدول المستخدمين (Base)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id),
  telegram_id BIGINT UNIQUE,
  language_code TEXT DEFAULT 'ar',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. جدول السائقين
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  city_id UUID NOT NULL REFERENCES cities(id),
  is_available BOOLEAN DEFAULT false,
  subscription_status TEXT CHECK (subscription_status IN ('none', 'trial', 'active', 'expired')),
  subscription_ends_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  capability TEXT CHECK (capability IN ('rides', 'delivery', 'both')),
  average_rating DECIMAL(3,2) DEFAULT 0,
  total_rides INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. جدول الركّاب
CREATE TABLE riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  city_id UUID NOT NULL REFERENCES cities(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. جدول الطلبات (للرحلات والتوصيلات)
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id),
  rider_id UUID NOT NULL REFERENCES riders(id),
  type TEXT CHECK (type IN ('ride', 'delivery')) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'searching', 'accepted', 'in_progress', 'completed', 'cancelled', 'escalated')) NOT NULL,
  pickup_lat DECIMAL(10, 8),
  pickup_lng DECIMAL(11, 8),
  pickup_address TEXT,
  dropoff_lat DECIMAL(10, 8),
  dropoff_lng DECIMAL(11, 8),
  dropoff_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. جدول العروض
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. جدول الرحلات/التوصيلات المكتملة
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. جدول التقييمات
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id),
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id UUID NOT NULL REFERENCES users(id),
  score INTEGER CHECK (score >= 1 AND score <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. جدول سجلات التدقيق
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES cities(id),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. جدول النزاعات
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id),
  request_id UUID REFERENCES requests(id),
  opened_by UUID NOT NULL REFERENCES users(id),
  status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) NOT NULL,
  assigned_to UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- فهارس
CREATE INDEX idx_drivers_city_available ON drivers(city_id, is_available);
CREATE INDEX idx_requests_city_status ON requests(city_id, status);
CREATE INDEX idx_offers_request_expires ON offers(request_id, status, expires_at);
CREATE INDEX idx_audit_city_user ON audit_logs(city_id, user_id);

-- RLS
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
