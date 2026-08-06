-- Migration: Cities and Platform Settings for Four Cities
-- Date: 2024
-- الغرض: إضافة المدن الأربع وإعدادات المنصة

-- ============================================
-- CITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  telegram_support_group_id TEXT,
  telegram_escalation_group_id TEXT,
  telegram_unsubscribed_drivers_group_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert the four cities
INSERT INTO cities (id, name_ar, name_en, is_active) VALUES
  ('jeddah', 'جدة', 'Jeddah', true),
  ('makkah', 'مكة المكرمة', 'Makkah', true),
  ('riyadh', 'الرياض', 'Riyadh', true),
  ('taif', 'الطائف', 'Taif', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PLATFORM SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default platform settings
INSERT INTO platform_settings (key, value, description) VALUES
  -- Subscription prices
  ('single_service_price', 
   '{"amount": 250, "currency": "SAR", "interval": "month"}',
   'Price for single service subscription (rides or delivery)'),
  ('dual_service_price',
   '{"amount": 400, "currency": "SAR", "interval": "month"}',
   'Price for both services subscription'),
  
  -- Trial
  ('trial_days',
   '{"days": 30}',
   'Number of free trial days for new drivers'),
  
  -- Matching
  ('matching_weights',
   '{"distance": 0.6, "rating": 0.4}',
   'Weights for matching algorithm (must sum to 1.0)'),
  ('search_radius_km',
   '{"km": 10}',
   'Maximum search radius in kilometers'),
  ('offer_timeout_seconds',
   '{"seconds": 45}',
   'Time before an offer expires'),
  
  -- Driver broadcast
  ('broadcast_top_drivers',
   '{"count": 5}',
   'Number of top drivers to broadcast offers to')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_cities_active ON cities(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(key);

-- ============================================
-- FUNCTION: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for cities
DROP TRIGGER IF EXISTS cities_updated_at ON cities;
CREATE TRIGGER cities_updated_at
  BEFORE UPDATE ON cities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger for platform_settings
DROP TRIGGER IF EXISTS platform_settings_updated_at ON platform_settings;
CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RPC FUNCTION: Get platform setting
-- ============================================
CREATE OR REPLACE FUNCTION get_platform_setting(p_key TEXT)
RETURNS JSONB AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT value INTO v_value
  FROM platform_settings
  WHERE key = p_key;
  
  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE cities IS 'Cities where the platform operates (Jeddah, Makkah, Riyadh, Taif)';
COMMENT ON COLUMN cities.telegram_support_group_id IS 'Telegram group ID for support/escalation';
COMMENT ON COLUMN cities.telegram_escalation_group_id IS 'Telegram group ID for operational escalation';
COMMENT ON COLUMN cities.telegram_unsubscribed_drivers_group_id IS 'Telegram group for unsubscribed drivers to accept requests';

COMMENT ON TABLE platform_settings IS 'Configurable platform settings (prices, weights, timeouts)';
COMMENT ON COLUMN platform_settings.key IS 'Setting identifier (snake_case)';
COMMENT ON COLUMN platform_settings.value IS 'Setting value as JSONB';
