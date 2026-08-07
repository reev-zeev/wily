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
  citySlug: string;
}

/**
 * Finds and broadcasts offers to available drivers.
 * يستخدم الموقع الحي للسائقين (current_lat, current_lng).
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

  // البحث عن السائقين المتاحين مع موقعهم الحي
  // يستخدم RPC الذي يحسب المسافة في القاعدة
  const { data: drivers, error: driversError } = await supabase.rpc(
    'get_available_drivers_with_location',
    {
      p_city_slug: input.citySlug,
      p_lat: input.pickupLat,
      p_lng: input.pickupLng,
      p_radius_km: searchRadiusKm,
      p_service_type: input.type,
      p_limit: 20,
    }
  );

  if (driversError) {
    console.error('Error fetching drivers with location:', driversError);
    return Err(driversError.message);
  }

  if (!drivers || drivers.length === 0) {
    return Ok([]);
  }

  // ترتيب السائقين بالنقاط
  const scoredDrivers: MatchedDriver[] = drivers.map((row: any) => {
    const distanceKm = Number(row.distance_km) || 999;
    const averageRating = Number(row.average_rating) || 0;

    // تطبيع المسافة (أقل مسافة = أعلى نقاط)
    const maxDistance = searchRadiusKm;
    const distanceScore = Math.max(0, 1 - distanceKm / maxDistance);

    // تطبيع التقييم (0-5 إلى 0-1)
    const ratingScore = averageRating / 5;

    // حساب النقاط النهائية
    const score = weights.distance * distanceScore + weights.rating * ratingScore;

    // بناء كائن السائق
    const driver = {
      id: row.driver_id as string,
      user_id: row.user_id as string,
      city_id: '',
      is_available: true,
      subscription_status: 'active' as const,
      subscription_ends_at: null,
      trial_ends_at: null,
      capability: row.capability,
      average_rating: averageRating,
      total_rides: 0,
      current_lat: Number(row.current_lat),
      current_lng: Number(row.current_lng),
      location_updated_at: null,
      created_at: '',
      updated_at: '',
    };

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
  cityId: string,
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
    city_id: cityId,
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
