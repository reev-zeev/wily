/**
 * الغرض: عميل Supabase للتفاعل مع قاعدة البيانات
 * الحالة: تنفيد فعلي
 * ينتمي إلى: infrastructure/supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@shared/config';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(config.supabase.url, config.supabase.serviceRoleKey);
  }
  return _client;
}

export function getSupabaseAnonClient(): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.anonKey);
}

export function getSupabaseAdmin(): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export type { SupabaseClient };
