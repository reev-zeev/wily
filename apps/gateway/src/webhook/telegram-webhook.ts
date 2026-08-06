/**
 * الغرض: Telegram webhook handler
 * الحالة: تنفيد فعلي
 * ينتمي إلى: apps/gateway/webhook
 */

import { Hono } from 'hono';
import { driverBot } from '../bots/driver';
import { riderBot } from '../bots/rider';

const webhook = new Hono<{ Bindings: Record<string, string> }>();

// ══════════════════════════════════════════════════════════════════
// TELEGRAM WEBHOOK
// ══════════════════════════════════════════════════════════════════

/**
 * POST /webhook/telegram/driver
 * Webhook for driver bot updates
 */
webhook.post('/telegram/driver', async (c) => {
  try {
    const botToken = c.env?.DRIVER_BOT_TOKEN ?? process.env.DRIVER_BOT_TOKEN;
    
    if (!botToken) {
      console.error('DRIVER_BOT_TOKEN not configured');
      return c.json({ error: 'Bot not configured' }, 500);
    }

    const update = await c.req.json();

    // Optional: verify webhook signature
    const secretToken = c.env?.TELEGRAM_WEBHOOK_SECRET ?? process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secretToken) {
      const signature = c.req.header('X-Telegram-Bot-Api-Secret-Token');
      if (signature !== secretToken) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
    }

    // Process update through grammY
    await driverBot.handleUpdate(update);

    return c.json({ ok: true });
  } catch (error) {
    console.error('Driver webhook error:', error);
    return c.json({ error: 'Internal error' }, 500);
  }
});

/**
 * POST /webhook/telegram/rider
 * Webhook for rider bot updates
 */
webhook.post('/telegram/rider', async (c) => {
  try {
    const botToken = c.env?.RIDER_BOT_TOKEN ?? process.env.RIDER_BOT_TOKEN;
    
    if (!botToken) {
      console.error('RIDER_BOT_TOKEN not configured');
      return c.json({ error: 'Bot not configured' }, 500);
    }

    const update = await c.req.json();

    // Optional: verify webhook signature
    const secretToken = c.env?.TELEGRAM_WEBHOOK_SECRET ?? process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secretToken) {
      const signature = c.req.header('X-Telegram-Bot-Api-Secret-Token');
      if (signature !== secretToken) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
    }

    // Process update through grammY
    await riderBot.handleUpdate(update);

    return c.json({ ok: true });
  } catch (error) {
    console.error('Rider webhook error:', error);
    return c.json({ error: 'Internal error' }, 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// SETUP ENDPOINTS
// ══════════════════════════════════════════════════════════════════

interface SetupBody {
  bot: 'driver' | 'rider';
  url: string;
}

/**
 * POST /webhook/telegram/setup
 * Set webhook URL for a bot (admin only)
 */
webhook.post('/telegram/setup', async (c) => {
  const apiKey = c.env?.ADMIN_API_KEY ?? process.env.ADMIN_API_KEY;
  const providedKey = c.req.header('X-Admin-Key');

  if (!apiKey || providedKey !== apiKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { bot, url } = await c.req.json<SetupBody>();

  if (!bot || !url) {
    return c.json({ error: 'Missing bot or url' }, 400);
  }

  const botToken = bot === 'driver'
    ? (c.env?.DRIVER_BOT_TOKEN ?? process.env.DRIVER_BOT_TOKEN)
    : (c.env?.RIDER_BOT_TOKEN ?? process.env.RIDER_BOT_TOKEN);

  if (!botToken) {
    return c.json({ error: 'Bot token not configured' }, 500);
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
        }),
      }
    );

    const result = await response.json() as { ok: boolean; description?: string };

    if (!result.ok) {
      return c.json({ error: result.description }, 400);
    }

    return c.json({
      ok: true,
      webhook_url: url,
      bot,
    });
  } catch (error) {
    console.error('Webhook setup error:', error);
    return c.json({ error: 'Failed to setup webhook' }, 500);
  }
});

/**
 * GET /webhook/telegram/status/:bot
 * Get webhook status for a bot
 */
webhook.get('/telegram/status/:bot', async (c) => {
  const bot = c.req.param('bot');

  if (!['driver', 'rider'].includes(bot)) {
    return c.json({ error: 'Invalid bot' }, 400);
  }

  const botToken = bot === 'driver'
    ? (c.env?.DRIVER_BOT_TOKEN ?? process.env.DRIVER_BOT_TOKEN)
    : (c.env?.RIDER_BOT_TOKEN ?? process.env.RIDER_BOT_TOKEN);

  if (!botToken) {
    return c.json({ error: 'Bot token not configured' }, 500);
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`
    );

    const result = await response.json();

    return c.json(result);
  } catch (error) {
    console.error('Webhook status error:', error);
    return c.json({ error: 'Failed to get webhook info' }, 500);
  }
});

export default webhook;
