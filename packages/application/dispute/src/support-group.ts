/**
 * الغرض: قروب الدعم والنزاعات
 * الحالة: تنفيد فعلي
 * ينتمي إلى: packages/application/dispute
 */

import { Result, Ok, Err } from '@shared/result';
import type { CitySlug } from '@infrastructure/supabase';
import {
  getCityBySlug,
  getRequestById,
} from '@infrastructure/supabase';
import { sendToGroup, sendMessage, getDriverBot } from '@infrastructure/notification';

export interface DisputeContext {
  requestId: string;
  openedBy: 'driver' | 'rider';
  openedByUserId: string;
  openedByTelegramId: number;
  reason: string;
  description?: string;
}

export async function openDisputeToSupportGroup(
  citySlug: CitySlug,
  dispute: DisputeContext
): Promise<Result<void, string>> {
  const cityResult = await getCityBySlug(citySlug);

  if (!cityResult.ok || !cityResult.value) {
    return Err('City not found');
  }

  const city = cityResult.value;
  const supportGroupId = city.telegram_support_group_id;

  if (!supportGroupId) {
    return Err('Support group not configured for this city');
  }

  const requestResult = await getRequestById(dispute.requestId);
  const request = requestResult.ok ? requestResult.value : null;

  const openerType = dispute.openedBy === 'driver' ? 'السائق' : 'الراكب';
  const openedAt = new Date().toLocaleString('ar-SA');

  const message =
    `📋 نزاع جديد #${dispute.requestId.slice(0, 8)}\n\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `👤 openedBy: ${openerType}\n` +
    `📅 openedAt: ${openedAt}\n\n` +
    `📍 نوع الطلب: ${request?.type === 'ride' ? 'مشوار' : 'توصيل'}\n` +
    `من: ${request?.pickup_address ?? 'غير محدد'}\n` +
    `إلى: ${request?.dropoff_address ?? 'غير محدد'}\n\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `❓ السبب: ${dispute.reason}\n` +
    `${dispute.description ? `📝 التفاصيل: ${dispute.description}\n` : ''}` +
    `\n━━━━━━━━━━━━━━━\n\n` +
    `👆 استخدم الأزرار أدناه للرد`;

  await sendToGroup({
    groupId: supportGroupId.toString(),
    text: message,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: '✅ استلام الحالة',
            callback_data: `support_claim:${dispute.requestId}`,
          },
        ],
        [
          {
            text: '🔒 قفل النزاع',
            callback_data: `support_close:${dispute.requestId}`,
          },
        ],
      ],
    },
  });

  await sendMessage(getDriverBot(), {
    chatId: dispute.openedByTelegramId,
    text: `✅ تم فتح نزاع بنجاح.\n\n` +
          `رقم النزاع: #${dispute.requestId.slice(0, 8)}\n\n` +
          `فريق الدعم سيتواصل معك قريباً.`,
  });

  return Ok(undefined);
}

export async function escalateToSupport(
  citySlug: CitySlug,
  requestId: string,
  escalatedBy: string,
  reason: string
): Promise<Result<void, string>> {
  const cityResult = await getCityBySlug(citySlug);

  if (!cityResult.ok || !cityResult.value) {
    return Err('City not found');
  }

  const city = cityResult.value;
  const supportGroupId = city.telegram_support_group_id;

  if (!supportGroupId) {
    return Err('Support group not configured');
  }

  const message =
    `⚠️ تصعيد يدوي #${requestId.slice(0, 8)}\n\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `👤 openedBy: ${escalatedBy}\n` +
    `📅 openedAt: ${new Date().toLocaleString('ar-SA')}\n\n` +
    `❗ السبب: ${reason}`;

  await sendToGroup({
    groupId: supportGroupId.toString(),
    text: message,
  });

  return Ok(undefined);
}
