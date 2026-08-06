/**
 * الغرض: آلية الثلاثة بالتتابع للسائقين غير المشتركين
 * الحالة: تنفيد فعلي
 * ينتمي إلى: packages/application/subscription
 * 
 * القسم 3.4 من الأمر الأصلي:
 * 
 * عندما لا يوجد سائق مشترك متاح يقبل خلال المهلة:
 * 1. يُنشر البوت بطاقة الطلب (نوع الخدمة، منطقة تقريبية، بدون رقم الزبون) 
 *    في telegram_unsubscribed_drivers_group_id الخاص بمدينة الطلب، مع زر "قبول".
 * 2. أول 3 ضغطات على الزر يُسجَّل بالترتيب (عبر RPC ذرّي يمنع تسجيل 
 *    نفس الشخص مرتين ويمنع تجاوز الثلاثة).
 * 3. يُفتح تواصل (Relay عبر البوت، بلا كشف أرقام) بين السائق الأول فقط والزبون.
 * 4. إن رفض الزبون الاتفاق مع السائق الأول، أو انتهت مهلة تفاوض محددة بلا اتفاق صريح
 *    (زر "تم الاتفاق" يضغطه الزبون) → يُغلق تواصل الأول تلقائياً، ويُفتح مع الثاني،
 *    ثم الثالث بنفس المنطق إن لزم.
 * 5. إن لم يتفق أي من الثلاثة، يُعاد نشر البطاقة من جديد في نفس القروب
 *    (تكرار الدورة من الخطوة 1)، مع عدّاد يمنع نفس السائقين الثلاثة 
 *    من التسجيل مرة أخرى في نفس الدورة المباشرة التالية.
 */

import { Result, Ok, Err } from '@shared/result';
import type { CitySlug } from '@infrastructure/supabase';
import {
  claimUnsubscribedSlot,
  updateRequestStatus,
  getRequestById,
  getCityBySlug,
} from '@infrastructure/supabase';
import { sendToGroup, sendMessage, getRiderBot } from '@infrastructure/notification';

// ══════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════

export interface UnsubscribedRequestContext {
  requestId: string;
  citySlug: CitySlug;
  type: 'ride' | 'delivery';
  pickupAddress: string;
  dropoffAddress: string;
  riderTelegramId: number;
  expiresAt: Date;
}

export interface UnsubscribedSlot {
  slotNumber: number;
  driverId: string;
  driverTelegramId: number;
  status: 'pending' | 'contacted' | 'rejected' | 'expired' | 'success';
  isFirst: boolean;
}

export interface SequentialThreeResult {
  success: boolean;
  requestId: string;
  currentSlot: number;
  totalSlots: number;
  contactedDriverId?: string;
  contactedDriverTelegramId?: number;
  error?: string;
}

export interface CycleState {
  cycleNumber: number;
  currentSlot: number;
  rejectedDrivers: string[];
  totalCycles: number;
}

// ══════════════════════════════════════════════════════════════════
// POST REQUEST TO GROUP (Step 1)
// ══════════════════════════════════════════════════════════════════

export async function postUnsubscribedRequestToGroup(
  context: UnsubscribedRequestContext,
  cycleNumber: number = 1
): Promise<Result<void, string>> {
  const cityResult = await getCityBySlug(context.citySlug);

  if (!cityResult.ok || !cityResult.value) {
    return Err('City not found');
  }

  const city = cityResult.value;
  const groupId = city.telegram_unsubscribed_drivers_group_id;

  if (!groupId) {
    return Err('No unsubscribed group configured for this city');
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((context.expiresAt.getTime() - Date.now()) / 1000)
  );

  const serviceTypeText = context.type === 'ride' ? 'مشوار' : 'توصيل';
  const cycleText = cycleNumber > 1 ? ` (الدورة ${cycleNumber})` : '';

  const message =
    `🚨 طلب ${serviceTypeText}${cycleText}\n\n` +
    `📍 من: ${context.pickupAddress}\n` +
    `🎯 إلى: ${context.dropoffAddress}\n\n` +
    `⏱️ ينتهي خلال: ${remainingSeconds} ثانية\n\n` +
    `👆 اضغط "قبول" للتقديم`;

  await sendToGroup({
    groupId: groupId.toString(),
    text: message,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: '✅ قبول الطلب',
            callback_data: `accept_unsubscribed:${context.requestId}:${cycleNumber}`,
          },
        ],
      ],
    },
  });

  return Ok(undefined);
}

// ══════════════════════════════════════════════════════════════════
// HANDLE SLOT CLAIM (Step 2-3)
// ══════════════════════════════════════════════════════════════════

export async function handleUnsubscribedSlotClaim(
  requestId: string,
  driverId: string,
  driverTelegramId: number
): Promise<Result<SequentialThreeResult, string>> {
  // Call RPC to atomically claim slot
  const claimResult = await claimUnsubscribedSlot({
    request_id: requestId,
    driver_id: driverId,
    driver_telegram_id: driverTelegramId,
    timeout_seconds: 120, // 2 minutes for negotiation
  });

  if (!claimResult.success) {
    return Err(claimResult.error ?? 'Failed to claim slot');
  }

  // Get request details
  const requestResult = await getRequestById(requestId);
  if (!requestResult.ok || !requestResult.value) {
    return Err('Request not found');
  }

  const request = requestResult.value;

  // If this is the first slot, open communication with rider
  if (claimResult.is_first && claimResult.slot_number === 1) {
    // Update request status to indicate first contact
    await updateRequestStatus(requestId, 'offer_made');

    // Notify rider that a driver has been found
    await sendMessage(getRiderBot(), {
      chatId: request.rider_id,
      text: `🚗 تم العثور على سائق مهتم!\n\n` +
            `اسمع الآن من السائق للتفاوض على التفاصيل.`,
    });
  }

  return Ok({
    success: true,
    requestId,
    currentSlot: claimResult.slot_number ?? 1,
    totalSlots: claimResult.max_slots ?? 3,
    contactedDriverId: driverId,
    contactedDriverTelegramId: driverTelegramId,
  });
}

// ══════════════════════════════════════════════════════════════════
// ADVANCE TO NEXT SLOT (Step 4)
// ══════════════════════════════════════════════════════════════════

export async function advanceToNextSlot(
  requestId: string,
  rejectedDriverId: string
): Promise<Result<SequentialThreeResult, string>> {
  const supabase = (await import('@infrastructure/supabase')).getSupabaseClient();

  // Mark current driver as rejected
  const { error: updateError } = await supabase
    .from('unsubscribed_claims')
    .update({ status: 'rejected' })
    .eq('request_id', requestId)
    .eq('driver_id', rejectedDriverId);

  if (updateError) {
    return Err('Failed to update claim status');
  }

  // Get next pending claim
  const { data: nextClaim, error: nextError } = await supabase
    .from('unsubscribed_claims')
    .select('*, drivers(user_id)')
    .eq('request_id', requestId)
    .eq('status', 'pending')
    .order('slot_number', { ascending: true })
    .limit(1)
    .single();

  if (nextError || !nextClaim) {
    return Err('NO_MORE_SLOTS');
  }

  // Mark next driver as contacted
  await supabase
    .from('unsubscribed_claims')
    .update({ status: 'contacted' })
    .eq('id', nextClaim.id);

  // Notify rider about next driver
  const requestResult = await getRequestById(requestId);
  if (requestResult.ok && requestResult.value) {
    await sendMessage(getRiderBot(), {
      chatId: requestResult.value.rider_id,
      text: `👤 السائق السابق لم يتفق معك.\n\n` +
            `جاري التواصل مع السائق التالي...`,
    });
  }

  return Ok({
    success: true,
    requestId,
    currentSlot: nextClaim.slot_number,
    totalSlots: 3,
    contactedDriverId: nextClaim.driver_id,
    contactedDriverTelegramId: nextClaim.driver_telegram_id,
  });
}

// ══════════════════════════════════════════════════════════════════
// CHECK IF ALL SLOTS EXHAUSTED (Step 5)
// ══════════════════════════════════════════════════════════════════

export interface CycleCheckResult {
  hasMoreCycles: boolean;
  cycleNumber: number;
  rejectedDriversThisCycle: string[];
  allSlotsRejected: boolean;
}

export async function checkCycleStatus(requestId: string): Promise<CycleCheckResult> {
  const supabase = (await import('@infrastructure/supabase')).getSupabaseClient();

  // Get all claims for this request
  const { data: claims, error } = await supabase
    .from('unsubscribed_claims')
    .select('*')
    .eq('request_id', requestId);

  if (error || !claims) {
    return {
      hasMoreCycles: false,
      cycleNumber: 1,
      rejectedDriversThisCycle: [],
      allSlotsRejected: true,
    };
  }

  const pendingOrContacted = claims.filter(
    (c) => c.status === 'pending' || c.status === 'contacted'
  );
  const rejected = claims.filter((c) => c.status === 'rejected');
  const successful = claims.filter((c) => c.status === 'success');

  // If any driver succeeded, we're done
  if (successful.length > 0) {
    return {
      hasMoreCycles: false,
      cycleNumber: 1,
      rejectedDriversThisCycle: [],
      allSlotsRejected: false,
    };
  }

  // If all 3 slots are rejected, start a new cycle
  const allRejected = rejected.length >= 3 && pendingOrContacted.length === 0;

  return {
    hasMoreCycles: allRejected,
    cycleNumber: Math.floor(rejected.length / 3) + 1,
    rejectedDriversThisCycle: rejected.map((c) => c.driver_id),
    allSlotsRejected: allRejected,
  };
}

// ══════════════════════════════════════════════════════════════════
// COMPLETE NEGOTIATION (Driver and Rider agreed)
// ══════════════════════════════════════════════════════════════════

export async function completeUnsubscribedNegotiation(
  requestId: string,
  driverId: string
): Promise<Result<void, string>> {
  const supabase = (await import('@infrastructure/supabase')).getSupabaseClient();

  // Mark the successful claim
  const { error: claimError } = await supabase
    .from('unsubscribed_claims')
    .update({ status: 'success' })
    .eq('request_id', requestId)
    .eq('driver_id', driverId);

  if (claimError) {
    return Err('Failed to update claim status');
  }

  // Update request status to accepted
  await updateRequestStatus(requestId, 'accepted');

  // Cancel remaining claims
  await supabase
    .from('unsubscribed_claims')
    .update({ status: 'cancelled' })
    .eq('request_id', requestId)
    .eq('status', 'pending');

  return Ok(undefined);
}

// ══════════════════════════════════════════════════════════════════
// EXPIRE ALL REMAINING SLOTS
// ══════════════════════════════════════════════════════════════════

export async function expireAllRemainingSlots(
  requestId: string
): Promise<Result<void, string>> {
  const supabase = (await import('@infrastructure/supabase')).getSupabaseClient();

  const { error } = await supabase
    .from('unsubscribed_claims')
    .update({ status: 'expired' })
    .eq('request_id', requestId)
    .eq('status', 'pending');

  if (error) {
    return Err('Failed to expire slots');
  }

  return Ok(undefined);
}
