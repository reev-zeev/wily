/**
 * الغرض: نظام التقييم المتبادل (سائق ← راكب، راكب ← سائق)
 * الحالة: تنفيد فعلي
 * ينتمي إلى: packages/application/reputation
 * 
 * بعد كل رحلة/توصيلة مكتملة:
 * 1. كلا الطرفين يمكنه تقييم الآخر (1-5 نجوم)
 * 2. التعليق اختياري
 * 3. متوسط التقييم يُحدَّث فوراً
 * 4. يدخل في معادلة المطابقة (وزن التقييم)
 */

import { Result, Ok, Err } from '@shared/result';
import { getSupabaseClient } from '@infrastructure/supabase';
import type { CityId } from '@shared/kernel';

// ══════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════

export interface Rating {
  id: string;
  request_id: string;
  rater_type: 'driver' | 'rider';
  rater_id: string;
  rated_type: 'driver' | 'rider';
  rated_id: string;
  stars: number; // 1-5
  comment: string | null;
  created_at: string;
}

export interface RatingInput {
  request_id: string;
  rater_type: 'driver' | 'rider';
  rater_id: string;
  rated_id: string;
  stars: number;
  comment?: string;
}

export interface DriverStats {
  driver_id: string;
  average_rating: number;
  total_rides: number;
  response_rate: number;
}

export interface RiderStats {
  rider_id: string;
  average_rating: number;
  total_rides: number;
  cancellation_rate: number;
}

// ══════════════════════════════════════════════════════════════════
// VALIDATION
// ══════════════════════════════════════════════════════════════════

export function validateStars(stars: number): Result<number, string> {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return Err('Stars must be an integer between 1 and 5');
  }
  return Ok(stars);
}

export function validateComment(comment: string | undefined): Result<string | null, string> {
  if (comment === undefined) {
    return Ok(null);
  }
  if (comment.length > 500) {
    return Err('Comment must be 500 characters or less');
  }
  return Ok(comment.trim() || null);
}

// ══════════════════════════════════════════════════════════════════
// SUBMIT RATING
// ══════════════════════════════════════════════════════════════════

export async function submitRating(input: RatingInput): Promise<Result<Rating, string>> {
  const supabase = getSupabaseClient();

  // Validate input
  const starsResult = validateStars(input.stars);
  if (!starsResult.ok) {
    return Err(starsResult.error);
  }

  const commentResult = validateComment(input.comment);
  if (!commentResult.ok) {
    return Err(commentResult.error);
  }

  // Verify request exists and is completed
  const { data: request, error: requestError } = await supabase
    .from('requests')
    .select('status, driver_id, rider_id')
    .eq('id', input.request_id)
    .single();

  if (requestError || !request) {
    return Err('Request not found');
  }

  if (request.status !== 'completed') {
    return Err('Can only rate completed requests');
  }

  // Verify the rater is part of this request
  if (input.rater_type === 'driver' && request.driver_id !== input.rater_id) {
    return Err('Only the driver can submit this rating');
  }
  if (input.rater_type === 'rider' && request.rider_id !== input.rater_id) {
    return Err('Only the rider can submit this rating');
  }

  // Check if already rated
  const { data: existing } = await supabase
    .from('ratings')
    .select('id')
    .eq('request_id', input.request_id)
    .eq('rater_id', input.rater_id)
    .single();

  if (existing) {
    return Err('You have already rated this request');
  }

  // Insert rating
  const { data, error } = await supabase
    .from('ratings')
    .insert({
      request_id: input.request_id,
      rater_type: input.rater_type,
      rater_id: input.rater_id,
      rated_type: input.rater_type === 'driver' ? 'rider' : 'driver',
      rated_id: input.rated_id,
      stars: input.stars,
      comment: commentResult.value,
    })
    .select()
    .single();

  if (error) {
    return Err(`Failed to submit rating: ${error.message}`);
  }

  // Update average rating for the rated entity
  const ratedType = input.rater_type === 'driver' ? 'rider' : 'driver';
  await recalculateAverageRating(ratedType, input.rated_id);

  return Ok(data as Rating);
}

// ══════════════════════════════════════════════════════════════════
// RECALCULATE AVERAGE RATING
// ══════════════════════════════════════════════════════════════════

async function recalculateAverageRating(
  entityType: 'driver' | 'rider',
  entityId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const table = entityType === 'driver' ? 'drivers' : 'riders';

  // Calculate new average
  const { data: stats } = await supabase
    .from('ratings')
    .select('stars')
    .eq('rated_type', entityType)
    .eq('rated_id', entityId);

  if (!stats || stats.length === 0) {
    return;
  }

  const totalStars = stats.reduce((sum, r) => sum + r.stars, 0);
  const averageRating = totalStars / stats.length;

  // Update the entity
  await supabase
    .from(table)
    .update({
      average_rating: Math.round(averageRating * 100) / 100, // Round to 2 decimals
      updated_at: new Date().toISOString(),
    })
    .eq('id', entityId);
}

// ══════════════════════════════════════════════════════════════════
// GET DRIVER STATS
// ══════════════════════════════════════════════════════════════════

export async function getDriverStats(
  driverId: string
): Promise<Result<DriverStats, string>> {
  const supabase = getSupabaseClient();

  const { data: driver, error } = await supabase
    .from('drivers')
    .select('average_rating, total_rides, response_rate')
    .eq('id', driverId)
    .single();

  if (error || !driver) {
    return Err('Driver not found');
  }

  return Ok({
    driver_id: driverId,
    average_rating: driver.average_rating ?? 0,
    total_rides: driver.total_rides ?? 0,
    response_rate: driver.response_rate ?? 0,
  });
}

// ══════════════════════════════════════════════════════════════════
// GET RIDER STATS
// ══════════════════════════════════════════════════════════════════

export async function getRiderStats(
  riderId: string
): Promise<Result<RiderStats, string>> {
  const supabase = getSupabaseClient();

  const { data: rider, error } = await supabase
    .from('riders')
    .select('average_rating, total_rides, cancellation_rate')
    .eq('id', riderId)
    .single();

  if (error || !rider) {
    return Err('Rider not found');
  }

  return Ok({
    rider_id: riderId,
    average_rating: rider.average_rating ?? 0,
    total_rides: rider.total_rides ?? 0,
    cancellation_rate: rider.cancellation_rate ?? 0,
  });
}

// ══════════════════════════════════════════════════════════════════
// GET RATINGS FOR REQUEST
// ══════════════════════════════════════════════════════════════════

export async function getRatingsForRequest(
  requestId: string
): Promise<Result<Rating[], string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });

  if (error) {
    return Err(`Failed to fetch ratings: ${error.message}`);
  }

  return Ok(data as Rating[]);
}

// ══════════════════════════════════════════════════════════════════
// CHECK IF BOTH PARTIES HAVE RATED
// ══════════════════════════════════════════════════════════════════

export async function hasBothPartiesRated(
  requestId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { count } = await supabase
    .from('ratings')
    .select('*', { count: 'exact', head: true })
    .eq('request_id', requestId);

  return (count ?? 0) >= 2;
}

// ══════════════════════════════════════════════════════════════════
// MARK REQUEST AS RATED (update status to 'rated')
// ══════════════════════════════════════════════════════════════════

export async function markRequestAsRated(
  requestId: string
): Promise<Result<void, string>> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('requests')
    .update({
      status: 'rated',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (error) {
    return Err(`Failed to mark request as rated: ${error.message}`);
  }

  return Ok(undefined);
}
