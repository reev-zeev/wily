/**
 * الغرض: معالجة قبول/رفض/إنهاء الرحلات
 * الحالة: تنفيد فعلي
 * ينتمي إلى: apps/gateway/bots/driver/handlers
 */

import type { MyContext } from '../bot';
import {
  getUserByTelegramId,
  getDriverByUserId,
  getPendingOffersByDriverId,
  getRequestById,
  updateRequestStatus,
  claimRide,
  getSupabaseClient,
} from '@infrastructure/supabase';
import { sendMessageToRider } from '@infrastructure/notification';
import { getUserById } from '@infrastructure/supabase';

export async function handleAcceptOffer(
  ctx: MyContext,
  requestId: string
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ خطأ في التعرف على حسابك');
    return;
  }

  // جلب المستخدم والسائق
  const userResult = await getUserByTelegramId(telegramId);
  if (!userResult.ok || !userResult.value) {
    await ctx.reply('❌ لم يتم العثور على حسابك');
    return;
  }

  const driverResult = await getDriverByUserId(userResult.value.id);
  if (!driverResult.ok || !driverResult.value) {
    await ctx.reply('❌ لم يتم العثور على ملف السائق');
    return;
  }

  const driver = driverResult.value;

  // محاولة claim الرحلة
  const result = await claimRide({
    request_id: requestId,
    driver_id: driver.id,
  });

  if (!result.success) {
    const errorMessages: Record<string, string> = {
      ALREADY_CLAIMED: '❌ تم قبول هذه الرحلة بالفعل من قبل سائق آخر',
      REQUEST_NOT_AVAILABLE: '❌ هذه الرحلة لم تعد متاحة',
      REQUEST_NOT_FOUND: '❌ لم يتم العثور على الرحلة',
    };
    await ctx.reply(errorMessages[result.error ?? ''] ?? `❌ فشل القبول: ${result.error}`);
    return;
  }

  // جلب تفاصيل الطلب
  const requestResult = await getRequestById(requestId);
  if (requestResult.ok && requestResult.value) {
    const request = requestResult.value;

    // إشعار الراكب
    const riderResult = await getUserById(request.rider_id);
    if (riderResult.ok && riderResult.value?.telegram_id) {
      await sendMessageToRider(
        riderResult.value.telegram_id,
        `✅ تم قبول رحلتك!\n\n` +
          `📍 من: ${request.pickup_address ?? 'غير محدد'}\n` +
          `🎯 إلى: ${request.dropoff_address ?? 'غير محدد'}\n\n` +
          `السائق في الطريق إليك 🚗`
      );
    }

    await ctx.reply(
      '✅ تم قبول الرحلة بنجاح!\n\n' +
        `📍 من: ${request.pickup_address ?? 'غير محدد'}\n` +
        `🎯 إلى: ${request.dropoff_address ?? 'غير محدد'}\n\n` +
        'انتقل إلى موقع الراكب ثم اضغط /complete عند الوصول'
    );
  }
}

export async function handleRejectOffer(
  ctx: MyContext,
  requestId: string
): Promise<void> {
  await ctx.reply('🚫 تم رفض العرض');
}

export async function handleComplete(ctx: MyContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ خطأ في التعرف على حسابك');
    return;
  }

  // جلب السائق
  const userResult = await getUserByTelegramId(telegramId);
  if (!userResult.ok || !userResult.value) {
    await ctx.reply('❌ لم يتم العثور على حسابك');
    return;
  }

  const driverResult = await getDriverByUserId(userResult.value.id);
  if (!driverResult.ok || !driverResult.value) {
    await ctx.reply('❌ لم يتم العثور على ملف السائق');
    return;
  }

  // جلب العروض المعلقة
  const offersResult = await getPendingOffersByDriverId(driverResult.value.id);
  if (!offersResult.ok || offersResult.value.length === 0) {
    await ctx.reply('❌ لا توجد رحلات جارية');
    return;
  }

  const offer = offersResult.value[0];

  // جلب الطلب
  const requestResult = await getRequestById(offer.request_id);
  if (!requestResult.ok || !requestResult.value) {
    await ctx.reply('❌ خطأ في جلب تفاصيل الرحلة');
    return;
  }

  const request = requestResult.value;

  // تحديث حالة الطلب
  await updateRequestStatus(request.id, 'completed');

  // إشعار الراكب
  const riderResult = await getUserById(request.rider_id);
  if (riderResult.ok && riderResult.value?.telegram_id) {
    await sendMessageToRider(
      riderResult.value.telegram_id,
      '🏁 تم إنهاء الرحلة!\n\n' +
        'شكراً لاستخدامك وَصْلة 🚗\n\n' +
        'من فضلك قيّم السائق من خلال البوت'
    );
  }

  await ctx.reply(
    '✅ تم إنهاء الرحلة بنجاح!\n\n' +
      '📊 شكراً لك على استخدام وَصْلة\n' +
      '🕐 يمكنك الآن استقبال رحلات جديدة'
  );
}

export async function handleOffersList(ctx: MyContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ خطأ في التعرف على حسابك');
    return;
  }

  const userResult = await getUserByTelegramId(telegramId);
  if (!userResult.ok || !userResult.value) {
    await ctx.reply('❌ لم يتم العثور على حسابك');
    return;
  }

  const driverResult = await getDriverByUserId(userResult.value.id);
  if (!driverResult.ok || !driverResult.value) {
    await ctx.reply('❌ لم يتم العثور على ملف السائق');
    return;
  }

  const offersResult = await getPendingOffersByDriverId(driverResult.value.id);
  if (!offersResult.ok || offersResult.value.length === 0) {
    await ctx.reply('📭 لا توجد عروض معلقة');
    return;
  }

  let message = '📋 العروض المعلقة:\n\n';

  for (const offer of offersResult.value) {
    const requestResult = await getRequestById(offer.request_id);
    if (requestResult.ok && requestResult.value) {
      const request = requestResult.value;
      const expiresAt = new Date(offer.expires_at);
      const minutesLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000));

      message += `━━━━━━━━━━━━━━━\n`;
      message += `📍 من: ${request.pickup_address ?? 'غير محدد'}\n`;
      message += `🎯 إلى: ${request.dropoff_address ?? 'غير محدد'}\n`;
      message += `⏱️ ينتهي خلال: ${minutesLeft} دقيقة\n\n`;
      message += `[قبول الرحلة](https://t.me/your_bot?start=accept_${request.id})\n`;
    }
  }

  await ctx.reply(message, { link_preview_options: { is_disabled: true } });
}
