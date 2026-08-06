/**
 * الغرض: معالجة طلب الرحلة
 * الحالة: تنفيد فعلي
 * ينتمي إلى: apps/gateway/bots/rider/handlers
 */

import type { MyContext } from '../bot';
import {
  getUserByTelegramId,
  getRiderByUserId,
  createRequest,
  getRequestsByRiderId,
} from '@infrastructure/supabase';
import { findAndBroadcastDrivers } from '@infrastructure/dispatch';

interface RideRequestState {
  step: 'awaiting_pickup' | 'awaiting_dropoff';
  type: 'ride' | 'delivery';
  rider: { id: string; city_id: string };
  pickupLat?: number;
  pickupLng?: number;
  [key: string]: unknown;
}

export async function handleRideRequest(ctx: MyContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ خطأ في التعرف على حسابك');
    return;
  }

  // جلب المستخدم والراكب
  const userResult = await getUserByTelegramId(telegramId);
  if (!userResult.ok || !userResult.value) {
    await ctx.reply(
      '❌ لم يتم العثور على حسابك\n\n' +
        'استخدم /register للتسجيل أولاً'
    );
    return;
  }

  const riderResult = await getRiderByUserId(userResult.value.id);
  if (!riderResult.ok || !riderResult.value) {
    await ctx.reply(
      '❌ لم يتم العثور على ملف الراكب\n\n' +
        'استخدم /register للتسجيل أولاً'
    );
    return;
  }

  const rider = riderResult.value;

  // طلب موقع الانطلاق
  await ctx.reply(
    '🚗 طلب مشوار\n\n' +
      '📍 أرسل موقع الانطلاق\n' +
      '(يمكنك إرسال الموقع من تطبيق الخرائط)'
  );

  // تخزين الحالة
  ctx.state = { step: 'awaiting_pickup', type: 'ride', rider } as RideRequestState;
}

export async function handleDeliveryRequest(ctx: MyContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ خطأ في التعرف على حسابك');
    return;
  }

  const userResult = await getUserByTelegramId(telegramId);
  if (!userResult.ok || !userResult.value) {
    await ctx.reply(
      '❌ لم يتم العثور على حسابك\n\n' +
        'استخدم /register للتسجيل أولاً'
    );
    return;
  }

  const riderResult = await getRiderByUserId(userResult.value.id);
  if (!riderResult.ok || !riderResult.value) {
    await ctx.reply(
      '❌ لم يتم العثور على ملف الراكب\n\n' +
        'استخدم /register للتسجيل أولاً'
    );
    return;
  }

  const rider = riderResult.value;

  await ctx.reply(
    '📦 طلب توصيل\n\n' +
      '📍 أرسل موقع الاستلام\n' +
      '(يمكنك إرسال الموقع من تطبيق الخرائط)'
  );

  ctx.state = { step: 'awaiting_pickup', type: 'delivery', rider } as RideRequestState;
}

export async function handleLocation(ctx: MyContext): Promise<void> {
  const state = ctx.state as RideRequestState | undefined;
  
  if (!state || state.step !== 'awaiting_pickup') {
    await ctx.reply('❌ يرجى البدء بطلب جديد');
    return;
  }

  const location = ctx.message?.location;
  if (!location) {
    await ctx.reply('❌ يرجى إرسال موقع صحيح');
    return;
  }

  // تخزين موقع الاستلام
  state.pickupLat = location.latitude;
  state.pickupLng = location.longitude;
  state.step = 'awaiting_dropoff';

  await ctx.reply(
    '✅ تم استلام موقع الاستلام\n\n' +
      '🎯 الآن أرسل موقع الوجهة\n' +
      '(يمكنك إرسال الموقع من تطبيق الخرائط)'
  );
}

export async function handleDropoffLocation(ctx: MyContext): Promise<void> {
  const state = ctx.state as RideRequestState | undefined;

  if (!state || state.step !== 'awaiting_dropoff' || !state.pickupLat || !state.pickupLng) {
    await ctx.reply('❌ يرجى البدء بطلب جديد');
    return;
  }

  const location = ctx.message?.location;
  if (!location) {
    await ctx.reply('❌ يرجى إرسال موقع صحيح');
    return;
  }

  // إنشاء الطلب
  const requestResult = await createRequest({
    rider_id: state.rider.id,
    city_id: state.rider.city_id,
    type: state.type,
    pickup_lat: state.pickupLat,
    pickup_lng: state.pickupLng,
    pickup_address: `📍 ${state.pickupLat.toFixed(5)}, ${state.pickupLng.toFixed(5)}`,
    dropoff_lat: location.latitude,
    dropoff_lng: location.longitude,
    dropoff_address: `🎯 ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
  });

  if (!requestResult.ok) {
    await ctx.reply('❌ فشل في إنشاء الطلب');
    return;
  }

  const request = requestResult.value;

  // البحث عن السائقين
  await ctx.reply('🔍 جاري البحث عن سائق...');

  const matchResult = await findAndBroadcastDrivers({
    requestId: request.id,
    pickupLat: state.pickupLat,
    pickupLng: state.pickupLng,
    type: state.type,
    citySlug: 'jeddah', // TODO: Get from rider's city
  });

  if (!matchResult.ok) {
    await ctx.reply('❌ حدث خطأ في البحث عن سائق');
    return;
  }

  const drivers = matchResult.value;

  if (drivers.length === 0) {
    // لم يتم العثور على سائقين
    await ctx.reply(
      '⏳ لا يوجد سائقون متاحون حالياً\n\n' +
        '🔄 جاري إعادة المحاولة...\n' +
        '⏱️ سيتم إشعارك عند توفر سائق'
    );
  } else {
    await ctx.reply(
      `✅ تم العثور على ${drivers.length} سائق!\n\n` +
        '🚗 جاري إشعار السائقين...\n' +
        '⏱️ انتظر حتى يتم قبول رحلتك'
    );
  }

  // إعادة تعيين الحالة
  ctx.state = {};
}

export async function handleMyRequests(ctx: MyContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ خطأ في التعرف على حسابك');
    return;
  }

  const userResult = await getUserByTelegramId(telegramId);
  if (!userResult.ok || !userResult.value) {
    await ctx.reply('❌ لم يتم العثور على حسابك');
    return;
  }

  const riderResult = await getRiderByUserId(userResult.value.id);
  if (!riderResult.ok || !riderResult.value) {
    await ctx.reply('❌ لم يتم العثور على ملف الراكب');
    return;
  }

  const requestsResult = await getRequestsByRiderId(riderResult.value.id, 5);
  if (!requestsResult.ok) {
    await ctx.reply('❌ فشل في جلب الطلبات');
    return;
  }

  const requests = requestsResult.value;

  if (requests.length === 0) {
    await ctx.reply('📭 لا توجد طلبات سابقة');
    return;
  }

  let message = '📋 طلباتك الأخيرة:\n\n';

  for (const req of requests) {
    const statusEmoji: Record<string, string> = {
      searching: '🔍',
      accepted: '✅',
      in_progress: '🚗',
      completed: '🏁',
      cancelled: '❌',
    };

    const statusText: Record<string, string> = {
      searching: 'جاري البحث',
      accepted: 'تم القبول',
      in_progress: 'جارية',
      completed: 'منتهية',
      cancelled: 'ملغاة',
    };

    message += `${statusEmoji[req.status] ?? '❓'} ${statusText[req.status] ?? req.status}\n`;
    message += `📍 من: ${req.pickup_address ?? 'غير محدد'}\n`;
    message += `🎯 إلى: ${req.dropoff_address ?? 'غير محدد'}\n\n`;
  }

  await ctx.reply(message);
}
