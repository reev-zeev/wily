/**
 * الغرض: معالجة الاشتراك
 * الحالة: تنفيد فعلي
 * ينتمي إلى: apps/gateway/bots/driver/handlers
 */

import type { MyContext } from '../bot';
import {
  getUserByTelegramId,
  renewSubscription,
  getSupabaseClient,
} from '@infrastructure/supabase';

export async function handleSubscribe(
  ctx: MyContext,
  plan: 'rides' | 'delivery' | 'both'
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ خطأ في التعرف على حسابك');
    return;
  }

  // جلب المستخدم
  const userResult = await getUserByTelegramId(telegramId);
  if (!userResult.ok || !userResult.value) {
    await ctx.reply('❌ لم يتم العثور على حسابك. استخدم /register أولاً');
    return;
  }

  const user = userResult.value;

  // تجديد الاشتراك
  const result = await renewSubscription({
    driver_id: user.id,
    plan,
  });

  if (!result.success) {
    await ctx.reply(`❌ فشل الاشتراك: ${result.error ?? 'خطأ غير معروف'}`);
    return;
  }

  const planNames = {
    rides: '🚗 مشاوير فقط',
    delivery: '📦 توصيل فقط',
    both: '🚗📦 كلاهما',
  };

  await ctx.reply(
    `✅ تم الاشتراك بنجاح!\n\n` +
      `📋 الخطة: ${planNames[plan]}\n` +
      `💰 المبلغ: ${plan === 'both' ? '400' : '250'} ريال/شهر\n` +
      `📅 صالح حتى: نهاية الشهر\n\n` +
      `🆓 ملاحظة: فترة التجربة المجانية لا تزال سارية`
  );
}
