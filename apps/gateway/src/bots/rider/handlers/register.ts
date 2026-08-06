/**
 * الغرض: معالجة تسجيل الراكب
 * الحالة: تنفيد فعلي
 * ينتمي إلى: apps/gateway/bots/rider/handlers
 */

import type { MyContext } from '../bot';
import {
  getUserByTelegramId,
  createUser,
  getAllCities,
  createRider,
} from '@infrastructure/supabase';

export async function handleRegister(ctx: MyContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ خطأ في التعرف على حسابك');
    return;
  }

  // التحقق من التسجيل السابق
  const existingUser = await getUserByTelegramId(telegramId);
  if (existingUser.ok && existingUser.value) {
    await ctx.reply(
      '✅你已经注册了!\n\n' +
        '📋 你的选项:\n' +
        '🚗 /ride - 请求乘车\n' +
        '📦 /delivery - 请求配送\n' +
        '📜 /history - 查看历史'
    );
    return;
  }

  // 获取城市列表
  const citiesResult = await getAllCities();
  if (!citiesResult.ok || citiesResult.value.length === 0) {
    await ctx.reply('❌ 目前没有可用的城市');
    return;
  }

  const cities = citiesResult.value;

  // 创建城市键盘
  const keyboard = cities.map((city) => [
    { text: `📍 ${city.name_ar}`, callback_data: `rider_city:${city.id}` },
  ]);

  await ctx.reply('🏙️ اختر مدينتك:', {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
}

export async function handleCitySelection(
  ctx: MyContext,
  cityId: string
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ خطأ في التعرف على حسابك');
    return;
  }

  // 创建用户
  const userResult = await createUser({
    telegram_id: telegramId,
    city_id: cityId,
  });

  if (!userResult.ok) {
    await ctx.reply('❌ 注册失败');
    return;
  }

  const user = userResult.value;

  // 创建骑手档案
  const riderResult = await createRider({
    user_id: user.id,
    city_id: cityId,
  });

  if (!riderResult.ok) {
    await ctx.reply('❌ 创建骑手档案失败');
    return;
  }

  await ctx.reply(
    '✅ 注册成功!\n\n' +
      '🆓 你好！作为骑手，你完全免费使用我们的服务。\n\n' +
      '📋 你的选项:\n' +
      '🚗 /ride - 请求乘车\n' +
      '📦 /delivery - 请求配送\n\n' +
      '📜 /help - 获取更多信息'
  );
}
