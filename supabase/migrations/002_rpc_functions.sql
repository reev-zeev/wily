-- الغرض: دوال RPC الذرية للعمليات الحرجة
-- الحالة: هيكل فقط — لا تنفيذ. لا تُضِف منطقاً هنا قبل أمر تفعيل صريح.

-- claim_ride: يدّعي سائق رحلة (ذرّي مع SKIP LOCKED)
CREATE OR REPLACE FUNCTION claim_ride(
  p_request_id UUID,
  p_driver_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- هيكل فقط — التنفيذ يأتي مع تفعيل dispatch module
  RAISE EXCEPTION 'NOT_IMPLEMENTED: claim_ride';
END;
$$;

-- renew_subscription: يجدّد اشتراك سائق
CREATE OR REPLACE FUNCTION renew_subscription(
  p_driver_id UUID,
  p_plan TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- هيكل فقط — التنفيذ يأتي مع تفعيل subscription module
  RAISE EXCEPTION 'NOT_IMPLEMENTED: renew_subscription';
END;
$$;

-- record_attendance: يسجّل توفر سائق
CREATE OR REPLACE FUNCTION record_attendance(
  p_driver_id UUID,
  p_is_available BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- هيكل فقط — التنفيذ يأتي مع تفعيل capability module
  RAISE EXCEPTION 'NOT_IMPLEMENTED: record_attendance';
END;
$$;

-- claim_unsubscribed_slot: يحجز أحد السائقين الثلاثة غير المشتركين
CREATE OR REPLACE FUNCTION claim_unsubscribed_slot(
  p_request_id UUID,
  p_driver_telegram_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- هيكل فقط — التنفيذ يأتي مع تفعيل dispatch module
  RAISE EXCEPTION 'NOT_IMPLEMENTED: claim_unsubscribed_slot';
END;
$$;
