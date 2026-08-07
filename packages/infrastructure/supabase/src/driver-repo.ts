/**
 * الغرض: مستودع السائقين - عمليات CRUD
 * الحالة: تنفيد فعلي
 * ينتمي إلى: infrastructure/supabase
 */

import { getSupabaseClient } from './client';
import { Ok, Err, type Result } from '@shared/result';

export interface Driver {
  id: string;
  user_id: string;
  city_id: string;
  is_available: boolean;
  subscription_status: 'none' | 'trial' | 'active' | 'expired';
  subscription_ends_at: string | null;
  trial_ends_at: string | null;
  capability: 'rides' | 'delivery' | 'both' | null;
  average_rating: number;
  total_rides: number;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDriverInput {
  user_id: string;
  city_id: string;
}

export async function createDriver(
  input: CreateDriverInput
): Promise<Result<Driver, string>> {
  const supabase = getSupabaseClient();

  // جلب مدة التجربة من platform_settings
  const { data: trialData } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'trial_days')
    .single();

  const trialDays = trialData?.value?.days ?? 30;
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

  const { data, error } = await supabase
    .from('drivers')
    .insert({
      user_id: input.user_id,
      city_id: input.city_id,
      subscription_status: 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
      is_available: false,
    })
    .select()
    .single();

  if (error) {
    return Err(error.message);
  }

  return Ok(data as Driver);
}

export async function getDriverByUserId(
  userId: string
): Promise<Result<Driver | null, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('drivers')
    .select()
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return Err(error.message);
  }

  return Ok(data as Driver | null);
}

export async function getDriverById(
  driverId: string
): Promise<Result<Driver | null, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('drivers')
    .select()
    .eq('id', driverId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return Err(error.message);
  }

  return Ok(data as Driver | null);
}

export interface FindAvailableDriversInput {
  city_id: string;
  capability: 'rides' | 'delivery' | 'both';
  limit?: number;
}

export async function findAvailableDrivers(
  input: FindAvailableDriversInput
): Promise<Result<Driver[], string>> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  // البحث عن السائقين المتاحين المشتركين أو داخل فترة التجربة
  const { data, error } = await supabase
    .from('drivers')
    .select()
    .eq('city_id', input.city_id)
    .eq('is_available', true)
    .or(
      `and(subscription_status.eq.active,subscription_ends_at.gt.${now}),` +
      `and(subscription_status.eq.trial,trial_ends_at.gt.${now})`
    )
    .in('capability', [input.capability, 'both'])
    .order('average_rating', { ascending: false })
    .limit(input.limit ?? 10);

  if (error) {
    return Err(error.message);
  }

  return Ok((data ?? []) as Driver[]);
}

export function isDriverActive(driver: Driver): boolean {
  const now = new Date();
  
  if (driver.subscription_status === 'active' && driver.subscription_ends_at) {
    return new Date(driver.subscription_ends_at) > now;
  }
  
  if (driver.subscription_status === 'trial' && driver.trial_ends_at) {
    return new Date(driver.trial_ends_at) > now;
  }
  
  return false;
}

// ══════════════════════════════════════════════════════════════════
// SUBSCRIPTION PRICES (from platform_settings)
// ══════════════════════════════════════════════════════════════════

export interface SubscriptionPrices {
  single: number;  // rides_only or delivery_only
  dual: number;    // both
}

export async function getSubscriptionPrices(): Promise<Result<SubscriptionPrices, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['subscription_price_single', 'subscription_price_dual']);

  if (error) {
    return Err(error.message);
  }

  const single = data?.find((s) => s.key === 'subscription_price_single')?.value?.amount ?? 250;
  const dual = data?.find((s) => s.key === 'subscription_price_dual')?.value?.amount ?? 400;

  return Ok({
    single: Number(single),
    dual: Number(dual),
  });
}
