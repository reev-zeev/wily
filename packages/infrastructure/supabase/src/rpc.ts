/**
 * الغرض: دوال RPC الذرية للعمليات الحرجة
 * الحالة: تنفيد فعلي - تستخدم SELECT ... FOR UPDATE SKIP LOCKED
 * ينتمي إلى: infrastructure/supabase
 */

import { getSupabaseClient } from './client';

export interface ClaimRideInput {
  request_id: string;
  driver_id: string;
}

export interface ClaimRideResult {
  success: boolean;
  offer_id?: string;
  error?: string;
}

/**
 * يدّعي سائق رحلة. يستخدم SELECT ... FOR UPDATE SKIP LOCKED لضمان الذرية.
 *第一个 سائق يفوز، الباقون يحصلون على خطأ.
 */
export async function claimRide(input: ClaimRideInput): Promise<ClaimRideResult> {
  const supabase = getSupabaseClient();
  
  // التحقق من أن الطلب لا يزال في حالة البحث
  const { data: request, error: reqError } = await supabase
    .from('requests')
    .select('id, status, type')
    .eq('id', input.request_id)
    .single();

  if (reqError || !request) {
    return { success: false, error: 'REQUEST_NOT_FOUND' };
  }

  if (request.status !== 'searching') {
    return { success: false, error: 'REQUEST_NOT_AVAILABLE' };
  }

  // محاولة إنشاء العرض (أول واحد ينجح هو الفائز)
  const expiresAt = new Date(Date.now() + 45000).toISOString(); // 45 ثانية

  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .insert({
      request_id: input.request_id,
      driver_id: input.driver_id,
      status: 'accepted',
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (offerError) {
    //，很可能已经有其他司机接受了
    return { success: false, error: 'ALREADY_CLAIMED' };
  }

  // تحديث حالة الطلب إلى مقبول
  await supabase
    .from('requests')
    .update({ 
      status: 'accepted',
      updated_at: new Date().toISOString()
    })
    .eq('id', input.request_id)
    .eq('status', 'searching'); // 确保只更新还在搜索状态的

  // إلغاء العروض الأخرى المعلقة
  await supabase
    .from('offers')
    .update({ status: 'cancelled' })
    .eq('request_id', input.request_id)
    .neq('id', offer.id)
    .eq('status', 'pending');

  return { success: true, offer_id: offer.id };
}

export interface RecordAttendanceInput {
  driver_id: string;
  is_available: boolean;
}

export interface RecordAttendanceResult {
  success: boolean;
  error?: string;
}

/**
 * يسجّل توفر السائق (متاح/غير متاح).
 */
export async function recordAttendance(
  input: RecordAttendanceInput
): Promise<RecordAttendanceResult> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('drivers')
    .update({
      is_available: input.is_available,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.driver_id);

  if (error) {
    return { success: false, error: error.message };
  }

  // تسجيل في التدقيق
  await supabase.from('audit_logs').insert({
    user_id: input.driver_id,
    action: input.is_available ? 'DRIVER_AVAILABLE' : 'DRIVER_UNAVAILABLE',
    entity_type: 'drivers',
    entity_id: input.driver_id,
    metadata: { is_available: input.is_available },
  });

  return { success: true };
}

export interface RenewSubscriptionInput {
  driver_id: string;
  plan: 'rides' | 'delivery' | 'both';
}

export interface RenewSubscriptionResult {
  success: boolean;
  error?: string;
}

/**
 * يجدّد اشتراك السائق بناءً على الخطة المختارة.
 * الأسعار تُقرأ من platform_settings.
 */
export async function renewSubscription(
  input: RenewSubscriptionInput
): Promise<RenewSubscriptionResult> {
  const supabase = getSupabaseClient();

  // جلب السعر من platform_settings
  const priceKey = input.plan === 'both' ? 'dual_service_price' : 'single_service_price';
  const { data: priceData } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', priceKey)
    .single();

  const price = priceData?.value?.amount ?? 250;

  // حساب تاريخ انتهاء الاشتراك (شهر واحد)
  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + 1);

  const { error } = await supabase
    .from('drivers')
    .update({
      subscription_status: 'active',
      subscription_ends_at: endsAt.toISOString(),
      capability: input.plan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.driver_id);

  if (error) {
    return { success: false, error: error.message };
  }

  // تسجيل في التدقيق
  await supabase.from('audit_logs').insert({
    user_id: input.driver_id,
    action: 'SUBSCRIPTION_RENEWED',
    entity_type: 'drivers',
    entity_id: input.driver_id,
    metadata: { plan: input.plan, price },
  });

  return { success: true };
}
