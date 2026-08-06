/**
 * الغرض: مستودع الطلبات - عمليات CRUD
 * الحالة: تنفيد فعلي
 * ينتمي إلى: infrastructure/supabase
 */

import { getSupabaseClient } from './client';
import { Ok, Err, type Result } from '@shared/result';

export interface Request {
  id: string;
  city_id: string;
  rider_id: string;
  type: 'ride' | 'delivery';
  status: 'pending' | 'searching' | 'offer_made' | 'accepted' | 'in_progress' | 'completed' | 'rated' | 'expired' | 'cancelled' | 'escalated';
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_address: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  dropoff_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRequestInput {
  rider_id: string;
  city_id: string;
  type: 'ride' | 'delivery';
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;
}

export async function createRequest(
  input: CreateRequestInput
): Promise<Result<Request, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('requests')
    .insert({
      rider_id: input.rider_id,
      city_id: input.city_id,
      type: input.type,
      status: 'searching',
      pickup_lat: input.pickup_lat,
      pickup_lng: input.pickup_lng,
      pickup_address: input.pickup_address,
      dropoff_lat: input.dropoff_lat,
      dropoff_lng: input.dropoff_lng,
      dropoff_address: input.dropoff_address,
    })
    .select()
    .single();

  if (error) {
    return Err(error.message);
  }

  return Ok(data as Request);
}

export async function getRequestById(
  requestId: string
): Promise<Result<Request | null, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('requests')
    .select()
    .eq('id', requestId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return Err(error.message);
  }

  return Ok(data as Request | null);
}

export async function getRequestsByRiderId(
  riderId: string,
  limit: number = 10
): Promise<Result<Request[], string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('requests')
    .select()
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return Err(error.message);
  }

  return Ok((data ?? []) as Request[]);
}

export async function updateRequestStatus(
  requestId: string,
  status: Request['status']
): Promise<Result<Request, string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('requests')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    return Err(error.message);
  }

  return Ok(data as Request);
}
