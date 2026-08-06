/**
 * الغرض: مستودع الركّاب - عمليات CRUD
 * الحالة: تنفيد فعلي
 * ينتمي إلى: infrastructure/supabase
 */

import { getSupabaseClient } from './client';
import { Ok, Err, type Result } from '@shared/result';

export interface Rider {
  id: string;
  user_id: string;
  city_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRiderInput {
  user_id: string;
  city_id: string;
}

export async function createRider(
  input: CreateRiderInput
): Promise<Result<Rider, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('riders')
    .insert({
      user_id: input.user_id,
      city_id: input.city_id,
    })
    .select()
    .single();

  if (error) {
    return Err(error.message);
  }

  return Ok(data as Rider);
}

export async function getRiderByUserId(
  userId: string
): Promise<Result<Rider | null, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('riders')
    .select()
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return Err(error.message);
  }

  return Ok(data as Rider | null);
}

export async function getRiderById(
  riderId: string
): Promise<Result<Rider | null, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('riders')
    .select()
    .eq('id', riderId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return Err(error.message);
  }

  return Ok(data as Rider | null);
}
