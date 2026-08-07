/**
 * الغرض: اختبار تكامل end-to-end للطلب الكامل
 * الحالة: تنفيد فعلي
 * ينتمي إلى: tests/integration
 * 
 * المسار: طلب → مطابقة → قبول → إنهاء → تقييم
 * 
 * يتطلب Supabase محلي:
 * docker compose up -d
 * npx supabase start
 * 
 * لتشغيل هذه الاختبارات:
 * bun test tests/integration/e2e-flow.test.ts
 * 
 * أو skip إذا لم يكن Supabase متصلاً:
 * bun test tests/integration/
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Skip if no Supabase connection
const SKIP_INTEGRATION = !process.env.SUPABASE_URL || process.env.SKIP_INTEGRATION === 'true';

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgzMTkyM30.A1mK_VRkJRdmsxmW3i8V_4FRMUQ5IYlJGGY9L2NgZVQ';

// Global test state
let supabase: SupabaseClient;
let testCityId: string;
let testDriverId: string;
let testRiderId: string;
let testRequestId: string;
let testUserId: string;

describe.skipIf(SKIP_INTEGRATION)('E2E Flow: Request → Matching → Accept → Complete → Rate', () => {
  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Wait for Supabase to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanup();
  });

  test('1. Setup: Create test data (city, user, driver, rider)', async () => {
    // Get Jeddah city
    const { data: cities } = await supabase
      .from('cities')
      .select('id')
      .eq('slug', 'jeddah')
      .limit(1);

    expect(cities).toBeDefined();
    expect(cities!.length).toBeGreaterThan(0);
    testCityId = cities![0].id;

    // Create test user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        city_id: testCityId,
        telegram_id: 999999999 + Math.floor(Math.random() * 10000),
        language_code: 'ar',
      })
      .select()
      .single();

    expect(userError).toBeNull();
    expect(user).toBeDefined();
    testUserId = user.id;

    // Create test driver
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .insert({
        user_id: testUserId,
        city_id: testCityId,
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        capability: 'rides',
        current_lat: 21.5433,
        current_lng: 39.1728,
        is_available: true,
      })
      .select()
      .single();

    expect(driverError).toBeNull();
    expect(driver).toBeDefined();
    testDriverId = driver.id;

    // Create test rider
    const { data: rider, error: riderError } = await supabase
      .from('riders')
      .insert({
        user_id: testUserId,
        city_id: testCityId,
      })
      .select()
      .single();

    expect(riderError).toBeNull();
    expect(rider).toBeDefined();
    testRiderId = rider.id;

    console.log('Test data created:', { testCityId, testDriverId, testRiderId });
  });

  test('2. Rider creates a ride request', async () => {
    const { data: request, error } = await supabase
      .from('requests')
      .insert({
        city_id: testCityId,
        rider_id: testRiderId,
        type: 'ride',
        status: 'pending',
        pickup_lat: 21.5500,
        pickup_lng: 39.1700,
        pickup_address: 'شارع الأمير سلطان، جدة',
        dropoff_lat: 21.5800,
        dropoff_lng: 39.1900,
        dropoff_address: 'البلد القديمة، جدة',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(request).toBeDefined();
    expect(request.status).toBe('pending');
    testRequestId = request.id;

    console.log('Request created:', testRequestId);
  });

  test('3. Request transitions to searching state', async () => {
    const { data: request, error } = await supabase
      .from('requests')
      .update({ status: 'searching' })
      .eq('id', testRequestId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(request.status).toBe('searching');

    console.log('Request status: searching');
  });

  test('4. Find available drivers using RPC with live location', async () => {
    const { data: drivers, error } = await supabase.rpc(
      'get_available_drivers_with_location',
      {
        p_city_slug: 'jeddah',
        p_lat: 21.5500,
        p_lng: 39.1700,
        p_radius_km: 10,
        p_service_type: 'ride',
        p_limit: 10,
      }
    );

    expect(error).toBeNull();
    expect(drivers).toBeDefined();
    expect(drivers.length).toBeGreaterThan(0);

    // Verify driver is within radius
    const driver = drivers.find((d: any) => d.driver_id === testDriverId);
    expect(driver).toBeDefined();
    expect(Number(driver.distance_km)).toBeLessThan(10);

    console.log('Found drivers:', drivers.length);
  });

  test('5. Driver accepts the request using claim_ride RPC', async () => {
    const { data, error } = await supabase.rpc('claim_ride', {
      p_request_id: testRequestId,
      p_driver_id: testDriverId,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.success).toBe(true);

    console.log('Ride claimed by driver');
  });

  test('6. Verify request is accepted', async () => {
    const { data: request, error } = await supabase
      .from('requests')
      .select('status, driver_id')
      .eq('id', testRequestId)
      .single();

    expect(error).toBeNull();
    expect(request.status).toBe('accepted');
    expect(request.driver_id).toBe(testDriverId);

    console.log('Request accepted');
  });

  test('7. Update request to in_progress', async () => {
    const { data: request, error } = await supabase
      .from('requests')
      .update({ status: 'in_progress' })
      .eq('id', testRequestId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(request.status).toBe('in_progress');

    console.log('Request in progress');
  });

  test('8. Complete the trip', async () => {
    // Create trip record
    const { error: tripError } = await supabase.from('trips').insert({
      request_id: testRequestId,
      driver_id: testDriverId,
      started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      ended_at: new Date().toISOString(),
    });

    expect(tripError).toBeNull();

    // Update request status
    const { data: request, error } = await supabase
      .from('requests')
      .update({ status: 'completed' })
      .eq('id', testRequestId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(request.status).toBe('completed');

    console.log('Trip completed');
  });

  test('9. Submit rating', async () => {
    // Submit rider rating for driver
    const { error: ratingError } = await supabase.from('ratings').insert({
      request_id: testRequestId,
      city_id: testCityId,
      rater_type: 'rider',
      rater_id: testRiderId,
      rated_type: 'driver',
      rated_id: testDriverId,
      stars: 5,
      comment: 'رحلة ممتازة!',
    });

    expect(ratingError).toBeNull();

    // Update driver average rating
    const { data: ratings } = await supabase
      .from('ratings')
      .select('stars')
      .eq('rated_type', 'driver')
      .eq('rated_id', testDriverId);

    const avgRating = ratings!.reduce((sum: number, r: any) => sum + r.stars, 0) / ratings!.length;

    await supabase
      .from('drivers')
      .update({ average_rating: avgRating })
      .eq('id', testDriverId);

    console.log('Rating submitted:', avgRating);
  });

  test('10. Verify final state', async () => {
    const { data: request } = await supabase
      .from('requests')
      .select('status')
      .eq('id', testRequestId)
      .single();

    const { data: driver } = await supabase
      .from('drivers')
      .select('average_rating, total_rides')
      .eq('id', testDriverId)
      .single();

    expect(request!.status).toBe('completed');
    expect(driver!.average_rating).toBe(5);

    console.log('Final state verified');
    console.log('E2E FLOW COMPLETED SUCCESSFULLY');
  });
});

async function cleanup() {
  if (!testRequestId || !testDriverId || !testRiderId || !testUserId) return;

  // Delete in reverse order of creation
  await supabase.from('ratings').delete().eq('request_id', testRequestId);
  await supabase.from('trips').delete().eq('request_id', testRequestId);
  await supabase.from('requests').delete().eq('id', testRequestId);
  await supabase.from('offers').delete().eq('driver_id', testDriverId);
  await supabase.from('drivers').delete().eq('id', testDriverId);
  await supabase.from('riders').delete().eq('id', testRiderId);
  await supabase.from('users').delete().eq('id', testUserId);

  console.log('Test data cleaned up');
}
