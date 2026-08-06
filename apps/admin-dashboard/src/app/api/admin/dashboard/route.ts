/**
 * الغرض: لوحة تحكم المسؤول - API Routes
 * الحالة: تنفيد فعلي
 * ينتمي إلى: apps/admin-dashboard
 */

import { Hono } from 'hono';
import { getSupabaseAdmin } from '@infrastructure/supabase';

interface Env {
  ADMIN_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const admin = new Hono<{ Bindings: Env }>();

// ══════════════════════════════════════════════════════════════════
// MIDDLEWARE: Admin Auth
// ══════════════════════════════════════════════════════════════════

admin.use('/*', async (c, next) => {
  const apiKey = c.env.ADMIN_API_KEY ?? process.env.ADMIN_API_KEY;
  const providedKey = c.req.header('X-Admin-Key');

  if (!apiKey || providedKey !== apiKey) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
});

// ══════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ══════════════════════════════════════════════════════════════════

admin.get('/dashboard', async (c) => {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    { count: totalDrivers },
    { count: activeDrivers },
    { count: totalRiders },
    { count: todayRiders },
    { count: totalRequests },
    { count: todayRequests },
    { count: completedToday },
  ] = await Promise.all([
    supabase.from('drivers').select('*', { count: 'exact', head: true }),
    supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .eq('is_available', true),
    supabase.from('riders').select('*', { count: 'exact', head: true }),
    supabase
      .from('riders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    supabase.from('requests').select('*', { count: 'exact', head: true }),
    supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('updated_at', todayStart.toISOString()),
  ]);

  return c.json({
    drivers: {
      total: totalDrivers ?? 0,
      active: activeDrivers ?? 0,
    },
    riders: {
      total: totalRiders ?? 0,
      today: todayRiders ?? 0,
    },
    requests: {
      total: totalRequests ?? 0,
      today: todayRequests ?? 0,
      completed_today: completedToday ?? 0,
    },
  });
});

// ══════════════════════════════════════════════════════════════════
// DRIVERS MANAGEMENT
// ══════════════════════════════════════════════════════════════════

admin.get('/drivers', async (c) => {
  const supabase = getSupabaseAdmin();
  const page = parseInt(c.req.query('page') ?? '1');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('drivers')
    .select('*, users!inner(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    drivers: data,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit),
    },
  });
});

admin.get('/drivers/:id', async (c) => {
  const supabase = getSupabaseAdmin();
  const driverId = c.req.param('id');

  const { data, error } = await supabase
    .from('drivers')
    .select('*, users(*)')
    .eq('id', driverId)
    .single();

  if (error || !data) {
    return c.json({ error: 'Driver not found' }, 404);
  }

  const { data: trips } = await supabase
    .from('requests')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(10);

  return c.json({ driver: data, recent_trips: trips });
});

admin.post('/drivers/:id/subscribe', async (c) => {
  const supabase = getSupabaseAdmin();
  const driverId = c.req.param('id');
  const { plan, months = 1 } = await c.req.json<{
    plan: 'ride' | 'delivery' | 'both';
    months?: number;
  }>();

  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + months);

  const { error } = await supabase
    .from('drivers')
    .update({
      subscription_status: 'active',
      subscription_plan: plan,
      subscription_ends_at: endsAt.toISOString(),
    })
    .eq('id', driverId);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true, expires_at: endsAt.toISOString() });
});

admin.post('/drivers/:id/extend-trial', async (c) => {
  const supabase = getSupabaseAdmin();
  const driverId = c.req.param('id');
  const { days = 7 } = await c.req.json<{ days?: number }>();

  const { data: driver } = await supabase
    .from('drivers')
    .select('trial_ends_at')
    .eq('id', driverId)
    .single();

  if (!driver) {
    return c.json({ error: 'Driver not found' }, 404);
  }

  const currentEnd = driver.trial_ends_at
    ? new Date(driver.trial_ends_at)
    : new Date();
  const newEnd = new Date(currentEnd);
  newEnd.setDate(newEnd.getDate() + days);

  const { error } = await supabase
    .from('drivers')
    .update({ trial_ends_at: newEnd.toISOString() })
    .eq('id', driverId);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true, trial_extended_to: newEnd.toISOString() });
});

// ══════════════════════════════════════════════════════════════════
// RIDERS MANAGEMENT
// ══════════════════════════════════════════════════════════════════

admin.get('/riders', async (c) => {
  const supabase = getSupabaseAdmin();
  const page = parseInt(c.req.query('page') ?? '1');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('riders')
    .select('*, users!inner(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    riders: data,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit),
    },
  });
});

// ══════════════════════════════════════════════════════════════════
// REQUESTS MANAGEMENT
// ══════════════════════════════════════════════════════════════════

admin.get('/requests', async (c) => {
  const supabase = getSupabaseAdmin();
  const page = parseInt(c.req.query('page') ?? '1');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = (page - 1) * limit;
  const status = c.req.query('status');
  const city = c.req.query('city');

  let query = supabase
    .from('requests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  if (city) {
    query = query.eq('city_id', city);
  }

  const { data, error, count } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    requests: data,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit),
    },
  });
});

// ══════════════════════════════════════════════════════════════════
// CITIES MANAGEMENT
// ══════════════════════════════════════════════════════════════════

admin.get('/cities', async (c) => {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .order('name_ar');

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ cities: data });
});

admin.patch('/cities/:id', async (c) => {
  const supabase = getSupabaseAdmin();
  const cityId = c.req.param('id');
  const updates = await c.req.json();

  const { data, error } = await supabase
    .from('cities')
    .update(updates)
    .eq('id', cityId)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ city: data });
});

export default admin;
