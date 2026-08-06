/**
 * الغرض: معالجة التوفر (متاح/غير متاح)
 * الحالة: تنفيد فعلي
 * ينتمي إلى: apps/gateway/bots/driver/handlers
 */

import type { MyContext } from '../bot';
import {
  getUserByTelegramId,
  getDriverByUserId,
  recordAttendance,
} from '@infrastructure/supabase';

export async function handleAvailable(ctx: MyContext): Promise<void> {
  await toggleAvailability(ctx, true);
}

export async function handleUnavailable(ctx: MyContext): Promise<void> {
  await toggleAvailability(ctx, false);
}

async function toggleAvailability(ctx: MyContext, isAvailable: boolean): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ خطأ في التعرف على حسابك');
    return;
  }

  // جلب المستخدم والسائق
  const userResult = await getUserByTelegramId(telegramId);
  if (!userResult.ok || !userResult.value) {
    await ctx.reply('❌ لم يتم العثور على حسابك. استخدم /register أولاً');
    return;
  }

  const driverResult = await getDriverByUserId(userResult.value.id);
  if (!driverResult.ok || !driverResult.value) {
    await ctx.reply('❌ لم يتم العثور على ملف السائق');
    return;
  }

  const driver = driverResult.value;

  // التحقق من الاشتراك
  const now = new Date();
  const hasActiveSubscription =
    (driver.subscription_status === 'active' &&
      driver.subscription_ends_at &&
      new Date(driver.subscription_ends_at) > now) ||
    (driver.subscription_status === 'trial' &&
      driver.trial_ends_at &&
      new Date(driver.trial_ends_at) > now);

  if (!hasActiveSubscription) {
    await ctx.reply(
      '⚠️ ليس لديك اشتراك نشط.\n\n' +
        'استخدم /subscribe للاشتراك أو /help للمزيد من المعلومات.'
    );
    return;
  }

  // تسجيل التوفر
  const result = await recordAttendance({
    driver_id: driver.id,
    is_available: isAvailable,
  });

  if (!result.success) {
    await ctx.reply(`❌ فشل تحديث الحالة: ${result.error}`);
    return;
  }

  const statusText = isAvailable ? '✅ متاح الآن' : '⏸️ غير متاح';
  const statusEmoji = isAvailable ? '🟢' : '🔴';

  await ctx.reply(
    `${statusText}\n\n` +
      `${statusEmoji} حالة التوفر تم تحديثها\n` +
      '📊 يمكنك تغييرها في أي وقت باستخدام:\n' +
      '/available - لجعل نفسك متاحاً\n' +
      '/unavailable - لجعل نفسك غير متاح'
  );
}
