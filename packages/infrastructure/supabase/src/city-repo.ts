/**
 * الغرض: مستودع المدن - عمليات CRUD
 * الحالة: تنفيد فعلي
 * ينتمي إلى: infrastructure/supabase
 */

import { getSupabaseClient } from './client';
import { Ok, Err, type Result } from '@shared/result';

export interface City {
  id: string;
  name_ar: string;
  name_en: string;
  is_active: boolean;
  telegram_support_group_id: string | null;
  telegram_escalation_group_id: string | null;
  telegram_unsubscribed_drivers_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAllCities(): Promise<Result<City[], string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('cities')
    .select()
    .eq('is_active', true)
    .order('name_ar');

  if (error) {
    return Err(error.message);
  }

  return Ok((data ?? []) as City[]);
}

export async function getCityById(
  cityId: string
): Promise<Result<City | null, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('cities')
    .select()
    .eq('id', cityId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return Err(error.message);
  }

  return Ok(data as City | null);
}

// Cities enum for type safety
export const CITY_IDS = {
  JEDDAH: 'jeddah',
  MAKKAH: 'makkah',
  RIYADH: 'riyadh',
  TAIF: 'taif',
} as const;

export type CityId = typeof CITY_IDS[keyof typeof CITY_IDS];

export function getCityDisplayName(city: City, lang: 'ar' | 'en' = 'ar'): string {
  return lang === 'ar' ? city.name_ar : city.name_en;
}
