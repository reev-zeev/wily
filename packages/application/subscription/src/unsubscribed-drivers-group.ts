/**
 * الغرض: منطق السائقين غير المشتركين (مجموعة Telegram)
 * الحالة: تنفيد فعلي
 * ينتمي إلى: packages/application/subscription
 * 
 * المتاحون في المجموعة يمكنهم:
 * 1. استقبال الطلبات من المجموعة
 * 2. قبول الطلب بـ reply
 * 3. لا يمكنهم تقديم عروض - الطلب يذهب لأول من يرد
 */

import { Result, Ok, Err } from '@shared/result';
import type { CityId, ServiceType } from '@shared/kernel';
import {
  getSupabaseAdmin,
  getRequestById,
  updateRequestStatus,
  getCityById,
} from '@infrastructure/supabase';
import { sendToGroup } from '@infrastructure/notification';

export interface UnsubscribedGroupConfig {
  cityId: CityId;
  groupId: string;
  serviceType: ServiceType;
}

export interface GroupRequest {
  requestId: string;
  cityId: CityId;
  pickupAddress: string;
  dropoffAddress: string;
  type: ServiceType;
  postedAt: Date;
  expiresAt: Date;
}

export interface AcceptResult {
  success: boolean;
  requestId: string;
  driverId?: string;
  driverTelegramId?: string;
  error?: string;
}

// ══════════════════════════════════════════════════════════════════
// POST REQUEST TO GROUP
// ══════════════════════════════════════════════════════════════════

export async function postRequestToUnsubscribedGroup(
  config: UnsubscribedGroupConfig,
  request: GroupRequest
): Promise<Result<void, string>> {
  const supabase = getSupabaseAdmin();
  const cityResult = await getCityById(config.cityId);

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
    Math.floor((request.expiresAt.getTime() - Date.now()) / 1000)
  );

  const message =
    `🚨 طلب ${config.serviceType === 'ride' ? 'مشوار' : 'توصيل'}\n\n` +
    `📍 من: ${request.pickupAddress}\n` +
    `🎯 إلى: ${request.dropoffAddress}\n\n` +
    `⏱️ ينتهي خلال: ${remainingSeconds} ثانية\n\n` +
    `📩 للقبول: اضغط "قبول" أو رد على هذه الرسالة`;

  await sendToGroup({
    groupId,
    text: message,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: '✅ قبول الطلب',
            callback_data: `accept_group:${request.requestId}`,
          },
        ],
      ],
    },
  });

  return Ok(undefined);
}

// ══════════════════════════════════════════════════════════════════
// ACCEPT REQUEST FROM GROUP
// ══════════════════════════════════════════════════════════════════

export async function acceptRequestFromGroup(
  requestId: string,
  driverId: string,
  driverTelegramId: string
): Promise<Result<AcceptResult, string>> {
  const supabase = getSupabaseAdmin();

  // Get request details
  const requestResult = await getRequestById(requestId);
  if (!requestResult.ok || !requestResult.value) {
    return Err('Request not found');
  }

  const request = requestResult.value;

  // Check if request is still valid
  if (request.status !== 'searching') {
    return Err('Request is no longer available');
  }

  // Check if request has expired
  const updatedAt = new Date(request.updated_at);
  const now = new Date();
  const maxWaitSeconds = 120; // 2 minutes for group requests
  if ((now.getTime() - updatedAt.getTime()) / 1000 > maxWaitSeconds) {
    await updateRequestStatus(requestId, 'expired');
    return Err('Request has expired');
  }

  // Claim the request
  const { error } = await supabase.rpc('claim_ride', {
    p_request_id: requestId,
    p_driver_id: driverId,
  });

  if (error) {
    // Check if already claimed
    if (error.message?.includes('already')) {
      return Err('Request already claimed by another driver');
    }
    return Err(`Failed to claim: ${error.message}`);
  }

  // Update status
  await updateRequestStatus(requestId, 'accepted');

  return Ok({
    success: true,
    requestId,
    driverId,
    driverTelegramId,
  });
}

// ══════════════════════════════════════════════════════════════════
// CHECK SUBSCRIPTION STATUS
// ══════════════════════════════════════════════════════════

export interface SubscriptionCheck {
  isActive: boolean;
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number;
  plan: ServiceType | 'none';
}

export async function checkDriverSubscription(
  driverId: string
): Promise<Result<SubscriptionCheck, string>> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('drivers')
    .select('subscription_status, subscription_plan, subscription_ends_at, trial_ends_at')
    .eq('id', driverId)
    .single();

  if (error || !data) {
    return Err('Driver not found');
  }

  const now = new Date();
  const plan = (data.subscription_plan ?? 'none') as ServiceType | 'none';

  if (data.subscription_status === 'active') {
    const endsAt = new Date(data.subscription_ends_at);
    const daysRemaining = Math.max(
      0,
      Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    return Ok({
      isActive: true,
      isTrial: false,
      isExpired: daysRemaining <= 0,
      daysRemaining,
      plan,
    });
  }

  if (data.subscription_status === 'trial') {
    const trialEnds = new Date(data.trial_ends_at);
    const daysRemaining = Math.max(
      0,
      Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    return Ok({
      isActive: true,
      isTrial: true,
      isExpired: daysRemaining <= 0,
      daysRemaining,
      plan: 'both',
    });
  }

  return Ok({
    isActive: false,
    isTrial: false,
    isExpired: true,
    daysRemaining: 0,
    plan: 'none',
  });
}
