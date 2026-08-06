/**
 * الغرض: بوت السائق الرئيسي
 * الحالة: تنفيد فعلي
 * ينتمي إلى: apps/gateway/bots/driver
 */

import { Bot, type Context } from 'grammy';
import { getDriverBot } from '@infrastructure/notification';
import {
  handleRegister,
  handleCitySelection,
} from './handlers/register';
import { handleSubscribe } from './handlers/subscribe';
import {
  handleAvailable,
  handleUnavailable,
} from './handlers/availability';
import {
  handleAcceptOffer,
  handleComplete,
  handleOffersList,
} from './handlers/ride';

export type MyContext = Context & {
  state?: Record<string, unknown>;
};

export function setupDriverBot(): Bot<MyContext> {
  const bot = getDriverBot() as Bot<MyContext>;

  // Command: /start
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '👋 مرحباً بك في بوت سائقي وَصْلة!\n\n' +
        '🚗 هذا البوت مخصص للسائقين\n' +
        '📋 للبدء:\n' +
        '1️⃣ /register - التسجيل\n' +
        '2️⃣ /subscribe - الاشتراك\n' +
        '3️⃣ /available - جعل نفسك متاحاً\n\n' +
        '🆘 للمساعدة: /help'
    );
  });

  // Command: /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      '📖 دليل السائق:\n\n' +
        '━━━━━━━━━━━━━━━\n' +
        '/register - التسجيل كمستخدم جديد\n' +
        '/subscribe - الاشتراك (250/400 شهرياً)\n' +
        '/available - أنت الآن متاح\n' +
        '/unavailable - أنت غير متاح\n' +
        '/offers - عرض العروض المعلقة\n' +
        '/complete - إنهاء الرحلة الحالية\n' +
        '━━━━━━━━━━━━━━━\n\n' +
        '💡 نصائح:\n' +
        '- فترة تجربة مجانية 30 يوم\n' +
        '- اقبل العرض بسرعة لربح الرحلة!'
    );
  });

  // Command: /register
  bot.command('register', handleRegister);

  // Command: /subscribe
  bot.command('subscribe', async (ctx) => {
    await ctx.reply('💳 اختر نوع الاشتراك:', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚗 مشاوير فقط (250 ر.س)', callback_data: 'subscribe:rides' },
          ],
          [
            { text: '📦 توصيل فقط (250 ر.س)', callback_data: 'subscribe:delivery' },
          ],
          [
            { text: '🚗📦 كلاهما (400 ر.س)', callback_data: 'subscribe:both' },
          ],
        ],
      },
    });
  });

  // Command: /available
  bot.command('available', handleAvailable);

  // Command: /unavailable
  bot.command('unavailable', handleUnavailable);

  // Command: /offers
  bot.command('offers', handleOffersList);

  // Command: /complete
  bot.command('complete', handleComplete);

  // Callback queries
  bot.callbackQuery(/select_city:(.+)/, async (ctx) => {
    const cityId = ctx.match?.[1];
    if (!cityId) {
      await ctx.answerCallbackQuery('❌ خطأ');
      return;
    }
    await ctx.answerCallbackQuery();
    await handleCitySelection(ctx, cityId);
  });

  bot.callbackQuery(/subscribe:(.+)/, async (ctx) => {
    const plan = ctx.match?.[1] as 'rides' | 'delivery' | 'both';
    if (!['rides', 'delivery', 'both'].includes(plan)) {
      await ctx.answerCallbackQuery('❌ خطة غير صحيحة');
      return;
    }
    await ctx.answerCallbackQuery();
    await handleSubscribe(ctx, plan);
  });

  // Start with accept request
  bot.on('message:text', async (ctx) => {
    const text = ctx.message?.text ?? '';
    if (text.startsWith('/start accept_')) {
      const requestId = text.replace('/start accept_', '');
      await handleAcceptOffer(ctx, requestId);
    }
  });

  return bot;
}

export const driverBot = setupDriverBot();
