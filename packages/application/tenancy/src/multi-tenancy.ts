/**
 * الغرض: بنية تعدد المستأجرين (Multi-Tenancy)
 * الحالة: هيكل فقط — للتحجيم المستقبلي
 * ينتمي إلى: packages/application/tenancy
 * 
 * ملاحظة: الإصدار الحالي يستخدم city_id مباشرة.
 * هذا الهيكل يُفعَّل عند الحاجة لدعم:
 * - مؤسسات كبيرة بإدارة مستقلة
 * - أساطيل سائقين منفصلة
 * - تقارير وإحصائيات معزولة
 * 
 * نماذج التوسع:
 * 1. Schema per Tenant: كل مستأجر له schema منفصل في PostgreSQL
 * 2. Discriminator Column: عمود city_id/tenant_id في كل جدول
 * 3. Hybrid: قواعد بيانات منفصلة لكل مستأجر كبير
 */

import type { CityId } from '@shared/kernel';

// ══════════════════════════════════════════════════════════════════
// TYPES (هيكل فقط)
// ══════════════════════════════════════════════════════════════════

/**
 * معرف المستأجر
 * 
 * الإصدار الحالي: CityId (jeddah, makkah, riyadh, taif)
 * للمستقبل: معرف مؤسسة أو أسطول
 */
export type TenantId = CityId;

/**
 * سياق المستأجر الحالي
 * يُمرر في كل request لتحديد نطاق البيانات
 */
export interface TenantContext {
  tenantId: TenantId;
  userId: string;
  role: 'admin' | 'manager' | 'driver' | 'rider';
  permissions: string[];
}

/**
 * إعدادات المستأجر
 * 
 * ملاحظة: حالياً في جدول cities
 * للمستقبل: جدول tenants منفصل
 */
export interface TenantSettings {
  id: TenantId;
  name_ar: string;
  name_en: string;
  is_active: boolean;
  
  // السائقين
  driver_subscription_price_single: number;
  driver_subscription_price_dual: number;
  driver_trial_days: number;
  
  // المطابقة
  matching_search_radius_km: number;
  matching_offer_timeout_seconds: number;
  matching_broadcast_top_drivers: number;
  
  // Telegram Groups
  telegram_support_group_id: string | null;
  telegram_escalation_group_id: string | null;
  telegram_unsubscribed_drivers_group_id: string | null;
  
  // إعدادات إضافية للمستقبل
  max_active_requests_per_rider?: number;
  require_driver_documents?: boolean;
  custom_branding?: {
    logo_url?: string;
    primary_color?: string;
  };
}

// ══════════════════════════════════════════════════════════════════
// MIDDLEWARE (هيكل فقط)
// ══════════════════════════════════════════════════════════════════

/**
 * Middleware لاستخراج سياق المستأجر
 * 
 * ملاحظة: حالياً يستخدم city_id من المستخدم المسجل
 * للمستقبل: يستخرج من JWT أو header
 */
export function extractTenantContext(
  tenantId: TenantId,
  userId: string,
  role: TenantContext['role']
): TenantContext {
  return {
    tenantId,
    userId,
    role,
    permissions: getDefaultPermissions(role),
  };
}

/**
 * صلاحيات افتراضية حسب الدور
 */
function getDefaultPermissions(role: TenantContext['role']): string[] {
  switch (role) {
    case 'admin':
      return ['*'];
    case 'manager':
      return ['read', 'write', 'reports'];
    case 'driver':
      return ['requests:read', 'requests:accept', 'requests:complete'];
    case 'rider':
      return ['requests:create', 'requests:read'];
    default:
      return [];
  }
}

// ══════════════════════════════════════════════════════════════════
// RLS HELPERS (هيكل فقط)
// ══════════════════════════════════════════════════════════════════

/**
 * بناء شرط RLS لـ Supabase
 * 
 * ملاحظة: حالياً city_id هو العامل المميز
 * للمستقبل: tenant_id مع دعم schema per tenant
 */
export function buildRLSPolicy(tenantId: TenantId): string {
  return `city_id = '${tenantId}'`;
}

/**
 * التحقق من صلاحية الوصول للمستأجر
 */
export function canAccessTenant(
  context: TenantContext,
  targetTenantId: TenantId
): boolean {
  // Admin يمكنه الوصول لكل المستأجرين
  if (context.role === 'admin') {
    return true;
  }
  
  // الآخرون محصورون بمستأجرهم
  return context.tenantId === targetTenantId;
}

// ══════════════════════════════════════════════════════════════════
// TENANT ISOLATION (هيكل فقط)
// ══════════════════════════════════════════════════════════════════

/**
 * عزل بيانات المستأجر في الاستعلامات
 * 
 * ملاحظة: في الإصدار الحالي city_id كافٍ
 * للمستقبل مع schema per tenant:
 *   - استخدام supabase.schema(tenantId) 
 *   - أو connection string مختلف لكل مستأجر
 */
export function isolateTenantQuery<T extends { city_id?: string }>(
  query: T[],
  tenantId: TenantId
): T[] {
  return query.filter((item) => item.city_id === tenantId);
}

/**
 * إضافة tenant_id لجميع العمليات
 */
export function withTenantId<T extends Record<string, unknown>>(
  data: T,
  tenantId: TenantId
): T & { city_id: TenantId } {
  return {
    ...data,
    city_id: tenantId,
  };
}

// ══════════════════════════════════════════════════════════════════
// CROSS-TENANT OPERATIONS (هيكل فقط)
// ══════════════════════════════════════════════════════════════════

/**
 * الحصول على إعدادات مستأجر معين
 * 
 * ملاحظة: حالياً من جدول cities
 * للمستقبل: RPC call أو cache
 */
export async function getTenantSettings(
  tenantId: TenantId
): Promise<TenantSettings | null> {
  // TODO: Implement when tenant settings table is created
  // Currently falls back to platform_settings
  return null;
}

/**
 * التحقق من صلاحية طلب عبر مستأجرين
 * 
 * مثال: سائق في جدة لا يمكنه استقبال طلب من الرياض
 */
export function validateCrossTenantRequest(
  riderTenantId: TenantId,
  driverTenantId: TenantId
): boolean {
  return riderTenantId === driverTenantId;
}

export {};
