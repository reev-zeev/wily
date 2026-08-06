/**
 * الغرض: محول تيليجرام لإرسال الرسائل
 * الحالة: تنفيد فعلي
 * ينتمي إلى: infrastructure/notification
 */

import { Bot, type Context } from 'grammy';
import { Result, Ok, Err } from '@shared/result';

export type TelegramBot = Bot<Context>;

let _driverBot: TelegramBot | null = null;
let _riderBot: TelegramBot | null = null;

function getBotToken(botType: 'driver' | 'rider'): string {
  return botType === 'driver'
    ? process.env.TELEGRAM_DRIVER_BOT_TOKEN ?? ''
    : process.env.TELEGRAM_RIDER_BOT_TOKEN ?? '';
}

export function getDriverBot(): TelegramBot {
  if (!_driverBot) {
    const token = getBotToken('driver');
    if (!token) {
      throw new Error('TELEGRAM_DRIVER_BOT_TOKEN not configured');
    }
    _driverBot = new Bot(token);
  }
  return _driverBot;
}

export function getRiderBot(): TelegramBot {
  if (!_riderBot) {
    const token = getBotToken('rider');
    if (!token) {
      throw new Error('TELEGRAM_RIDER_BOT_TOKEN not configured');
    }
    _riderBot = new Bot(token);
  }
  return _riderBot;
}

export interface SendMessageInput {
  chatId: number | string;
  text: string;
  replyMarkup?: unknown;
}

export async function sendMessage(
  bot: TelegramBot,
  input: SendMessageInput
): Promise<Result<void, string>> {
  try {
    await bot.api.sendMessage(
      typeof input.chatId === 'string' ? parseInt(input.chatId) : input.chatId,
      input.text,
      {
        reply_markup: input.replyMarkup as any,
      }
    );
    return Ok(undefined);
  } catch (error) {
    return Err(error instanceof Error ? error.message : 'Failed to send message');
  }
}

export async function sendMessageToDriver(
  driverTelegramId: number,
  text: string,
  replyMarkup?: unknown
): Promise<Result<void, string>> {
  const bot = getDriverBot();
  return sendMessage(bot, {
    chatId: driverTelegramId,
    text,
    replyMarkup,
  });
}

export async function sendMessageToRider(
  riderTelegramId: number,
  text: string,
  replyMarkup?: unknown
): Promise<Result<void, string>> {
  const bot = getRiderBot();
  return sendMessage(bot, {
    chatId: riderTelegramId,
    text,
    replyMarkup,
  });
}

export interface SendToGroupInput {
  groupId: string;
  text: string;
  replyMarkup?: unknown;
}

export async function sendToGroup(input: SendToGroupInput): Promise<Result<void, string>> {
  const bot = getDriverBot();
  return sendMessage(bot, {
    chatId: parseInt(input.groupId),
    text: input.text,
    replyMarkup: input.replyMarkup,
  });
}
