/**
 * الغرض: أنواع handlers البوت
 * الحالة: تنفيد فعلي
 * ينتمي إلى: apps/gateway/bots/driver/handlers
 */

import type { Context } from 'grammy';

export interface MyContext extends Context {
  state?: Record<string, unknown>;
}

export interface CommandHandler {
  command: string;
  description: {
    ar: string;
    en: string;
  };
}

export interface CallbackHandler {
  pattern: RegExp;
  handler: (ctx: MyContext, match: RegExpMatchArray) => Promise<void>;
}

export type CommandHandlerFn = (ctx: MyContext) => Promise<void>;
export type CallbackHandlerFn = (ctx: MyContext, ...args: string[]) => Promise<void>;
