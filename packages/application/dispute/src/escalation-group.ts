/**
 * الغرض: قروب الإسناد (التدخل التشغيلي)
 * الحالة: تنفيد فعلي
 * ينتمي إلى: packages/application/dispute
 * 
 * قروب الإسناد (telegram_escalation_group_id):
 * - تدخل تشغيلي وليس نزاعاً
 * - حالات مثل: طلب فشلت مطابقته تماماً
 * - تفعيل حالة طوارئ (زر SOS)
 * - يتطلب تدخلاً بشرياً فورياً
 */

import { Result, Ok, Err } from '@shared/result';
import type { CitySlug } from '@infrastructure/supabase';
import { getCityBySlug } from '@infrastructure/supabase';
import { sendToGroup } from '@infrastructure/notification';

export type EscalationType = 
  | 'matching_failed'
  | 'sos_activated'
  | 'system_error'
  | 'manual_review';

export interface EscalationContext {
  requestId?: string;
  driverId?: string;
  riderId?: string;
  type: EscalationType;
  reason: string;
  details?: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════
// ESCALATE TO OPERATIONS GROUP
// ══════════════════════════════════════════════════════════════════

export async function escalateToOperationsGroup(
  citySlug: CitySlug,
  escalation: EscalationContext
): Promise<Result<void, string>> {
  const cityResult = await getCityBySlug(citySlug);

  if (!cityResult.ok || !cityResult.value) {
    return Err('City not found');
  }

  const city = cityResult.value;
  const escalationGroupId = city.telegram_escalation_group_id;

  if (!escalationGroupId) {
    return Err('Escalation group not configured for this city');
  }

  const typeEmoji = getEscalationEmoji(escalation.type);
  const typeLabel = getEscalationLabel(escalation.type);
  const openedAt = new Date().toLocaleString('ar-SA');

  let message =
    `${typeEmoji} ${typeLabel} #${escalation.requestId?.slice(0, 8) ?? 'SYSTEM'}\n\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `📅 openedAt: ${openedAt}\n\n`;

  if (escalation.requestId) {
    message = message + `📋 requestId: ${escalation.requestId}\n`;
  }
  if (escalation.driverId) {
    message = message + `🚗 driverId: ${escalation.driverId}\n`;
  }
  if (escalation.riderId) {
    message = message + `👤 riderId: ${escalation.riderId}\n`;
  }

  message = message +
    `\n━━━━━━━━━━━━━━━\n\n` +
    `❗ السبب: ${escalation.reason}\n`;

  if (escalation.details) {
    message = message + `\n📋 التفاصيل:\n`;
    for (const [key, value] of Object.entries(escalation.details)) {
      message = message + `- ${key}: ${value}\n`;
    }
  }

  message = message + `\n━━━━━━━━━━━━━━━\n\n` +
    `⚠️ يحتاج تدخل فوري`;

  await sendToGroup({
    groupId: escalationGroupId.toString(),
    text: message,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: '🔴 تدخل عاجل',
            callback_data: `ops_intervene:${escalation.requestId ?? 'system'}`,
          },
        ],
        [
          {
            text: '✅ تم المعالجة',
            callback_data: `ops_resolve:${escalation.requestId ?? 'system'}`,
          },
        ],
      ],
    },
  });

  return Ok(undefined);
}

// ══════════════════════════════════════════════════════════════════
// SOS ESCALATION (Emergency Button)
// ══════════════════════════════════════════════════════════════════

export async function escalateSOS(
  citySlug: CitySlug,
  requestId: string,
  triggeredBy: 'driver' | 'rider',
  userTelegramId: number,
  location?: { lat: number; lng: number }
): Promise<Result<void, string>> {
  const cityResult = await getCityBySlug(citySlug);

  if (!cityResult.ok || !cityResult.value) {
    return Err('City not found');
  }

  const city = cityResult.value;
  const escalationGroupId = city.telegram_escalation_group_id;

  if (!escalationGroupId) {
    return Err('Escalation group not configured');
  }

  let message =
    `🚨🚨🚨 حالة طوارئ 🚨🚨🚨\n\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `📋 requestId: ${requestId}\n` +
    `👤 openedBy: ${triggeredBy === 'driver' ? 'السائق' : 'الراكب'}\n` +
    `📅 openedAt: ${new Date().toLocaleString('ar-SA')}\n`;

  if (location) {
    message = message +
      `\n📍 الموقع:\n` +
      `lat: ${location.lat}\n` +
      `lng: ${location.lng}\n` +
      `🔗 https://maps.google.com/?q=${location.lat},${location.lng}`;
  }

  message = message +
    `\n━━━━━━━━━━━━━━━\n\n` +
    `⚠️ تدخل فوري مطلوب!`;

  await sendToGroup({
    groupId: escalationGroupId.toString(),
    text: message,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: '🚨 التدخل الآن',
            callback_data: `sos_intervene:${requestId}`,
          },
        ],
      ],
    },
  });

  return Ok(undefined);
}

// ══════════════════════════════════════════════════════════════════
// MATCHING FAILED ESCALATION
// ══════════════════════════════════════════════════════════════════

export async function escalateMatchingFailed(
  citySlug: CitySlug,
  requestId: string,
  cyclesAttempted: number,
  reason: string
): Promise<Result<void, string>> {
  return escalateToOperationsGroup(citySlug, {
    requestId,
    type: 'matching_failed',
    reason,
    details: {
      cycles_attempted: cyclesAttempted,
      requires_manual_matching: 'نعم',
    },
  });
}

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════

function getEscalationEmoji(type: EscalationType): string {
  switch (type) {
    case 'matching_failed':
      return '⚠️';
    case 'sos_activated':
      return '🚨';
    case 'system_error':
      return '❌';
    case 'manual_review':
      return '👁️';
    default:
      return '📢';
  }
}

function getEscalationLabel(type: EscalationType): string {
  switch (type) {
    case 'matching_failed':
      return 'فشل المطابقة';
    case 'sos_activated':
      return 'طوارئ';
    case 'system_error':
      return 'خطأ في النظام';
    case 'manual_review':
      return 'مراجعة يدوية';
    default:
      return 'تصعيد';
  }
}
