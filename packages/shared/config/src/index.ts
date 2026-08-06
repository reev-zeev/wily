/**
 * الغرض: تحميل وتصدير إعدادات المنصة من متغيرات البيئة
 * الحالة: تنفيد فعلي — أساس تقني بحت
 * ينتمي إلى: shared
 */

const config = {
  // Telegram
  telegram: {
    driverBotToken: process.env.TELEGRAM_DRIVER_BOT_TOKEN ?? '',
    riderBotToken: process.env.TELEGRAM_RIDER_BOT_TOKEN ?? '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    anonKey: process.env.SUPABASE_ANON_KEY ?? '',
  },

  // Upstash Redis
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL ?? '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
  },

  // App
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },
};

export type Config = typeof config;

export { config };
