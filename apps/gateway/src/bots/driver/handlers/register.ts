/**
 * الغرض: معالجة تسجيل السائق
 * الحالة: تنفيد فعلي
 * ينتمي إلى: apps/gateway/bots/driver/handlers
 */

import type { MyContext } from '../bot';
import type { CommandHandler } from './types';
import { InlineKeyboard } from 'grammy';
import {
  getUserByTelegramId,
  createUser,
  getAllCities,
  createDriver,
  getSubscriptionPrices,
  type City,
} from '@infrastructure/supabase';

export const registerHandler: CommandHandler = {
  command: 'register',
  description: { ar: 'تسجيل كمستخدم جديد', en: 'Register as new user' },
};

export async function handleRegister(ctx: MyContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ خطأ في التعرف على حسابك');
    return;
  }

  // جلب قائمة المدن
  const citiesResult = await getAllCities();
  if (!citiesResult.ok || citiesResult.value.length === 0) {
    await ctx.reply('❌ لا توجد مدن متاحة حالياً');
    return;
  }

  const cities = citiesResult.value;

  // إنشاء لوحة مفاتيح المدن
  const keyboard = new InlineKeyboard();
  for (const city of cities) {
    keyboard.text(`📍 ${city.name_ar}`, `select_city:${city.id}`).row();
  }

  await ctx.reply('🏙️ اختر مدينتك:', {
    reply_markup: keyboard,
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

  // التحقق من المستخدم الموجود
  const existingUser = await getUserByTelegramId(telegramId);
  if (existingUser.ok && existingUser.value) {
    await ctx.reply('✅ أنت مسجل بالفعل!');
    return;
  }

  // إنشاء المستخدم
  const userResult = await createUser({
    telegram_id: telegramId,
    city_id: cityId,
  });

  if (!userResult.ok) {
    await ctx.reply('❌ خطأ في التسجيل');
    return;
  }

  const user = userResult.value;

  // إنشاء ملف السائق
  const driverResult = await createDriver({
    user_id: user.id,
    city_id: cityId,
  });

  if (!driverResult.ok) {
    await ctx.reply('❌ خطأ في إنشاء ملف السائق');
    return;
  }

  // جلب الأسعار من platform_settings
  const pricesResult = await getSubscriptionPrices();
  const prices = pricesResult.ok ? pricesResult.value : { single: 250, dual: 400 };

  const keyboard = new InlineKeyboard()
    .text('🚗 مشاوير فقط', 'subscribe:rides')
    .row()
    .text('📦 توصيل فقط', 'subscribe:delivery')
    .row()
    .text('🚗📦 كلاهما', 'subscribe:both');

  await ctx.reply(
    '✅ تم التسجيل بنجاح!\n\n' +
      '📋 اختر نوع الاشتراك:\n\n' +
      `1️⃣ مشاوير فقط - ${prices.single} ريال/شهر\n` +
      `2️⃣ توصيل فقط - ${prices.single} ريال/شهر\n` +
      `3️⃣ كلاهما - ${prices.dual} ريال/شهر\n\n` +
      '🆓 لديك 30 يوم تجربة مجانية!',
    { reply_markup: keyboard }
  );
}
