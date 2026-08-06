/**
 * الغرض: نقطة الدخول الرئيسية لخادم Hono + بوتات Telegram
 * الحالة: تنفيد فعلي
 * ينتمي إلى: apps/gateway
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { setupDriverBot } from './bots/driver';
import { setupRiderBot } from './bots/rider';

const app = new Hono();

app.get('/', (c) => c.text('Wasla Gateway - Running'));

// إعداد البوتات
const driverBot = setupDriverBot();
const riderBot = setupRiderBot();

const port = parseInt(process.env.PORT ?? '3000');

console.log(`🚀 Starting Wasla Gateway on port ${port}`);
console.log(`🤖 Driver bot: ${process.env.DRIVER_BOT_TOKEN ? 'Configured' : 'NOT CONFIGURED'}`);
console.log(`🤖 Rider bot: ${process.env.RIDER_BOT_TOKEN ? 'Configured' : 'NOT CONFIGURED'}`);

// بدء البوتات (long polling في development)
if (process.env.NODE_ENV !== 'production') {
  driverBot.start();
  riderBot.start();
}

serve({
  fetch: app.fetch,
  port,
});

export default app;
