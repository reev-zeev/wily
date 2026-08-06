/**
 * الغرض: مستودع المستخدمين - عمليات CRUD
 * الحالة: تنفيد فعلي
 * ينتمي إلى: infrastructure/supabase
 */

import { getSupabaseClient } from './client';
import { Ok, Err, type Result } from '@shared/result';

export interface User {
  id: string;
  city_id: string;
  telegram_id: number | null;
  language_code: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  telegram_id: number;
  city_id: string;
  language_code?: string;
}

export async function createUser(
  input: CreateUserInput
): Promise<Result<User, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('users')
    .insert({
      telegram_id: input.telegram_id,
      city_id: input.city_id,
      language_code: input.language_code ?? 'ar',
    })
    .select()
    .single();

  if (error) {
    return Err(error.message);
  }

  return Ok(data as User);
}

export async function getUserByTelegramId(
  telegramId: number
): Promise<Result<User | null, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('telegram_id', telegramId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return Err(error.message);
  }

  return Ok(data as User | null);
}

export async function getUserById(
  userId: string
): Promise<Result<User | null, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return Err(error.message);
  }

  return Ok(data as User | null);
}

export async function updateUserLanguage(
  userId: string,
  languageCode: string
): Promise<Result<User, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('users')
    .update({
      language_code: languageCode,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    return Err(error.message);
  }

  return Ok(data as User);
}
