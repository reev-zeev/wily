/**
 * الغرض: مستودع العروض
 * الحالة: تنفيد فعلي
 * ينتمي إلى: infrastructure/supabase
 */

import { getSupabaseClient } from './client';
import { Ok, Err, type Result } from '@shared/result';

export interface Offer {
  id: string;
  request_id: string;
  driver_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  expires_at: string;
  created_at: string;
}

export async function getOffersByRequestId(
  requestId: string
): Promise<Result<Offer[], string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('offers')
    .select()
    .eq('request_id', requestId)
    .order('created_at');

  if (error) {
    return Err(error.message);
  }

  return Ok((data ?? []) as Offer[]);
}

export async function getPendingOffersByDriverId(
  driverId: string
): Promise<Result<Offer[], string>> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('offers')
    .select()
    .eq('driver_id', driverId)
    .eq('status', 'pending')
    .gt('expires_at', now)
    .order('created_at', { ascending: false });

  if (error) {
    return Err(error.message);
  }

  return Ok((data ?? []) as Offer[]);
}

export async function expireOffer(offerId: string): Promise<Result<void, string>> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('offers')
    .update({ status: 'expired' })
    .eq('id', offerId)
    .eq('status', 'pending');

  if (error) {
    return Err(error.message);
  }

  return Ok(undefined);
}

export async function expireAllPendingOffersForRequest(
  requestId: string
): Promise<Result<number, string>> {
  const supabase = getSupabaseClient();

  const { error, count } = await supabase
    .from('offers')
    .update({ status: 'expired' })
    .eq('request_id', requestId)
    .eq('status', 'pending');

  if (error) {
    return Err(error.message);
  }

  return Ok(count ?? 0);
}
