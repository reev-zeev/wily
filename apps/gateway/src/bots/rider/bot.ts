/**
 * الغرض: بوت الراكب الرئيسي
 * الحالة: تنفيد فعلي
 * ينتمي إلى: apps/gateway/bots/rider
 */

import { Bot, type Context } from 'grammy';
import {
  handleRegister,
  handleCitySelection,
} from './handlers/register';
import {
  handleRideRequest,
  handleDeliveryRequest,
  handleLocation,
  handleDropoffLocation,
  handleMyRequests,
} from './handlers/ride';

export type MyContext = Context & {
  state?: Record<string, unknown>;
};

export function setupRiderBot(): Bot<MyContext> {
  const bot = new Bot<MyContext>(process.env.RIDER_BOT_TOKEN ?? '');

  // Command: /start
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '👋 مرحباً بك في وَصْلة!\n\n' +
        '🚗 منصة نقل موثوقة\n' +
        '📦 توصيل طرود\n\n' +
        '🆓 مجاني تماماً للراكبين!\n\n' +
        '📋 للبدء:\n' +
        '1️⃣ /register - التسجيل\n' +
        '2️⃣ /ride - طلب مشوار\n' +
        '3️⃣ /delivery - طلب توصيل\n\n' +
        '🆘 /help - للمساعدة'
    );
  });

  // Command: /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      '📖 دليل الراكب:\n\n' +
        '━━━━━━━━━━━━━━━\n' +
        '/register - التسجيل\n' +
        '/ride - طلب مشوار\n' +
        '/delivery - طلب توصيل\n' +
        '/myrequests - طلباتي\n' +
        '━━━━━━━━━━━━━━━\n\n' +
        '💡 نصائح:\n' +
        '- أرسل موقعك من تطبيق الخرائط\n' +
        '- الخدمة مجانية تماماً!\n' +
        '- قيم سائقك بعد الرحلة'
    );
  });

  // Command: /register
  bot.command('register', handleRegister);

  // Command: /ride
  bot.command('ride', handleRideRequest);

  // Command: /delivery
  bot.command('delivery', handleDeliveryRequest);

  // Command: /myrequests
  bot.command('myrequests', handleMyRequests);

  // Callback queries
  bot.callbackQuery(/rider_city:(.+)/, async (ctx) => {
    const cityId = ctx.match?.[1];
    if (!cityId) {
      await ctx.answerCallbackQuery('❌ خطأ');
      return;
    }
    await ctx.answerCallbackQuery();
    await handleCitySelection(ctx, cityId);
  });

  // Handle location messages
  bot.on('message:location', async (ctx) => {
    const state = ctx.state as { step?: string } | undefined;
    
    if (state?.step === 'awaiting_dropoff') {
      await handleDropoffLocation(ctx);
    } else {
      await handleLocation(ctx);
    }
  });

  return bot;
}

export const riderBot = setupRiderBot();
