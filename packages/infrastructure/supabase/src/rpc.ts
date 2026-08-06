/**
 * الغرض: دوال RPC الذرية للعمليات الحرجة
 * الحالة: تنفيد فعلي - تستخدم SELECT ... FOR UPDATE SKIP LOCKED
 * ينتمي إلى: infrastructure/supabase
 * 
 * هذه الـ wrappers تستدعي RPC functions في القاعدة
 * المعرفة في migration 004_fix_cities_and_location.sql
 */

import { getSupabaseClient } from './client';

export interface ClaimRideInput {
  request_id: string;
  driver_id: string;
}

export interface ClaimRideResult {
  success: boolean;
  request_id?: string;
  driver_id?: string;
  error?: string;
}

/**
 * يدّعي سائق رحلة عبر RPC ذري.
 * يستخدم SELECT ... FOR UPDATE SKIP LOCKED لضمان الذرية.
 */
export async function claimRide(input: ClaimRideInput): Promise<ClaimRideResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('claim_ride', {
    p_request_id: input.request_id,
    p_driver_id: input.driver_id,
  });

  if (error) {
    console.error('claim_ride RPC error:', error);
    return { success: false, error: error.message };
  }

  return data as ClaimRideResult;
}

export interface RecordAttendanceInput {
  driver_id: string;
  is_available: boolean;
  lat?: number;
  lng?: number;
}

export interface RecordAttendanceResult {
  success: boolean;
  driver_id?: string;
  is_available?: boolean;
  error?: string;
  subscription_status?: string;
}

/**
 * يسجّل توفر السائق (متاح/غير متاح) مع الموقع الحي.
 */
export async function recordAttendance(
  input: RecordAttendanceInput
): Promise<RecordAttendanceResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('record_attendance', {
    p_driver_id: input.driver_id,
    p_is_available: input.is_available,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
  });

  if (error) {
    console.error('record_attendance RPC error:', error);
    return { success: false, error: error.message };
  }

  return data as RecordAttendanceResult;
}

export interface RenewSubscriptionInput {
  driver_id: string;
  plan: 'rides' | 'delivery' | 'both';
  months?: number;
}

export interface RenewSubscriptionResult {
  success: boolean;
  driver_id?: string;
  plan?: string;
  price?: number;
  expires_at?: string;
  error?: string;
}

/**
 * يجدّد اشتراك السائق عبر RPC ذري.
 */
export async function renewSubscription(
  input: RenewSubscriptionInput
): Promise<RenewSubscriptionResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('renew_subscription', {
    p_driver_id: input.driver_id,
    p_plan: input.plan,
    p_months: input.months ?? 1,
  });

  if (error) {
    console.error('renew_subscription RPC error:', error);
    return { success: false, error: error.message };
  }

  return data as RenewSubscriptionResult;
}

export interface ClaimUnsubscribedSlotInput {
  request_id: string;
  driver_id: string;
  driver_telegram_id: number;
  timeout_seconds?: number;
}

export interface ClaimUnsubscribedSlotResult {
  success: boolean;
  slot_number?: number;
  max_slots?: number;
  expires_at?: string;
  is_first?: boolean;
  error?: string;
}

/**
 * يحجز slot في آلية الثلاثة للتسلسل.
 */
export async function claimUnsubscribedSlot(
  input: ClaimUnsubscribedSlotInput
): Promise<ClaimUnsubscribedSlotResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('claim_unsubscribed_slot', {
    p_request_id: input.request_id,
    p_driver_id: input.driver_id,
    p_driver_telegram_id: input.driver_telegram_id,
    p_timeout_seconds: input.timeout_seconds ?? 120,
  });

  if (error) {
    console.error('claim_unsubscribed_slot RPC error:', error);
    return { success: false, error: error.message };
  }

  return data as ClaimUnsubscribedSlotResult;
}

export interface UpdateDriverLocationInput {
  driver_id: string;
  lat: number;
  lng: number;
}

export interface UpdateDriverLocationResult {
  success: boolean;
  lat?: number;
  lng?: number;
  error?: string;
}

/**
 * يحدث موقع السائق الحي من Telegram.
 */
export async function updateDriverLocation(
  input: UpdateDriverLocationInput
): Promise<UpdateDriverLocationResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('update_driver_location', {
    p_driver_id: input.driver_id,
    p_lat: input.lat,
    p_lng: input.lng,
  });

  if (error) {
    console.error('update_driver_location RPC error:', error);
    return { success: false, error: error.message };
  }

  return data as UpdateDriverLocationResult;
}
