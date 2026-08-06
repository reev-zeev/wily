/**
 * الغرض: محول تيليجرام لإرسال الرسائل
 * الحالة: تنفيد فعلي
 * ينتمي إلى: infrastructure/notification
 */

import { Bot, type Context } from 'grammy';
import { config } from '@shared/config';

export type TelegramBot = Bot<Context>;

let _driverBot: TelegramBot | null = null;
let _riderBot: TelegramBot | null = null;

export function getDriverBot(): TelegramBot {
  if (!_driverBot) {
    _driverBot = new Bot(config.telegram.driverBotToken);
  }
  return _driverBot;
}

export function getRiderBot(): TelegramBot {
  if (!_riderBot) {
    _riderBot = new Bot(config.telegram.riderBotToken);
  }
  return _riderBot;
}

export interface SendMessageInput {
  chatId: number;
  text: string;
  replyMarkup?: unknown;
}

export async function sendMessage(
  bot: TelegramBot,
  input: SendMessageInput
): Promise<void> {
  await bot.api.sendMessage(input.chatId, input.text, {
    reply_markup: input.replyMarkup as any,
  });
}

export async function sendMessageToDriver(
  driverTelegramId: number,
  text: string,
  replyMarkup?: unknown
): Promise<void> {
  const bot = getDriverBot();
  await sendMessage(bot, {
    chatId: driverTelegramId,
    text,
    replyMarkup,
  });
}

export async function sendMessageToRider(
  riderTelegramId: number,
  text: string,
  replyMarkup?: unknown
): Promise<void> {
  const bot = getRiderBot();
  await sendMessage(bot, {
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

export async function sendToGroup(input: SendToGroupInput): Promise<void> {
  const bot = getDriverBot(); // أو rider bot حسب المجموعة
  await sendMessage(bot, {
    chatId: parseInt(input.groupId),
    text: input.text,
    replyMarkup: input.replyMarkup,
  });
}
