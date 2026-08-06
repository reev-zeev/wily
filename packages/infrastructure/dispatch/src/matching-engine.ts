/**
 * الغرض: محرك المطابقة البسيط للطلبات مع السائقين
 * الحالة: تنفيد فعلي
 * ينتمي إلى: infrastructure/dispatch
 * ملاحظات: يستخدم معادلة نقاط بسيطة (المسافة + التقييم)
 */

import {
  findAvailableDrivers,
  type Driver,
  type Request,
} from '@infrastructure/supabase';
import { getSupabaseClient } from '@infrastructure/supabase';
import { Ok, Err, type Result } from '@shared/result';

export interface MatchingWeights {
  distance: number;
  rating: number;
}

export interface MatchedDriver {
  driver: Driver;
  score: number;
  distance_km: number;
}

export interface MatchRequestInput {
  requestId: string;
  pickupLat: number;
  pickupLng: number;
  type: 'ride' | 'delivery';
  cityId: string;
}

/**
 * Finds and broadcasts offers to available drivers.
 * الأول الذين يقبلون wins.
 */
export async function findAndBroadcastDrivers(
  input: MatchRequestInput
): Promise<Result<MatchedDriver[], string>> {
  const supabase = getSupabaseClient();

  // جلب الأوزان من platform_settings
  const { data: weightsData } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'matching_weights')
    .single();

  const weights: MatchingWeights = weightsData?.value ?? {
    distance: 0.6,
    rating: 0.4,
  };

  // جلب نصف قطر البحث
  const { data: radiusData } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'search_radius_km')
    .single();

  const searchRadiusKm = radiusData?.value?.km ?? 10;

  // البحث عن السائقين المتاحين
  const capability = input.type === 'ride' ? 'rides' : 'delivery';
  const driversResult = await findAvailableDrivers({
    city_id: input.cityId,
    capability,
    limit: 20,
  });

  if (!driversResult.ok) {
    return Err(driversResult.error);
  }

  const drivers = driversResult.value;

  if (drivers.length === 0) {
    return Ok([]);
  }

  // ترتيب السائقين بالنقاط
  // score = (weight_distance * distance_score) + (weight_rating * rating_score)
  const scoredDrivers: MatchedDriver[] = drivers.map((driver) => {
    // حساب المسافة (سنستخدم Haversine لاحقاً، الآن قيمة مؤقتة)
    const distanceKm = calculateHaversineDistance(
      input.pickupLat,
      input.pickupLng,
      21.5433, // lat مؤقت
      39.1728 // lng مؤقت
    );

    // تطبيع المسافة (أقل مسافة = أعلى نقاط)
    const maxDistance = searchRadiusKm;
    const distanceScore = Math.max(0, 1 - distanceKm / maxDistance);

    // تطبيع التقييم (0-5 إلى 0-1)
    const ratingScore = driver.average_rating / 5;

    // حساب النقاط النهائية
    const score = weights.distance * distanceScore + weights.rating * ratingScore;

    return {
      driver,
      score,
      distance_km: distanceKm,
    };
  });

  // ترتيب تنازلياً حسب النقاط
  scoredDrivers.sort((a, b) => b.score - a.score);

  // أخذ أفضل 5 فقط
  return Ok(scoredDrivers.slice(0, 5));
}

/**
 * Haversine formula لحساب المسافة بين نقطتين.
 */
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // نصف قطر الأرض بالكيلومتر
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Creates pending offers for matched drivers.
 */
export async function createOffersForDrivers(
  requestId: string,
  drivers: MatchedDriver[]
): Promise<Result<number, string>> {
  const supabase = getSupabaseClient();

  // جلب مهلة العرض من platform_settings
  const { data: timeoutData } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'offer_timeout_seconds')
    .single();

  const timeoutSeconds = timeoutData?.value?.seconds ?? 45;
  const expiresAt = new Date(Date.now() + timeoutSeconds * 1000).toISOString();

  const offers = drivers.map((d) => ({
    request_id: requestId,
    driver_id: d.driver.id,
    status: 'pending',
    expires_at: expiresAt,
  }));

  const { error } = await supabase.from('offers').insert(offers);

  if (error) {
    return Err(error.message);
  }

  return Ok(drivers.length);
}
