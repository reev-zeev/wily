/**
 * الغرض: الأنواع الأساسية المشتركة عبر المنصة
 * الحالة: تنفيد فعلي — أساس تقني بحت
 * ينتمي إلى: shared
 */

// معرفات UUID
export type UUID = string;

export type EntityId = UUID;

// الطوابع الزمنية
export interface Timestamped {
  created_at: Date;
  updated_at: Date;
}

// Roles
export type UserRole = 'driver' | 'rider' | 'admin';

// City IDs (Saudi Arabia)
export type CityId = 'jeddah' | 'makkah' | 'riyadh' | 'taif';

export interface City {
  id: CityId;
  name_ar: string;
  name_en: string;
  is_active: boolean;
  telegram_support_group_id: string | null;
  telegram_escalation_group_id: string | null;
  telegram_unsubscribed_drivers_group_id: string | null;
}

// أنواع الخدمة
export type ServiceType = 'ride' | 'delivery' | 'both';

// حالة الاشتراك
export type SubscriptionStatus = 'none' | 'trial' | 'active' | 'expired';

// حالة الطلب
export type RequestStatus =
  | 'pending'
  | 'searching'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'escalated';

// حالة العرض
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

// اللغات المدعومة
export type Language = 'ar' | 'en' | 'ur';

// إحداثيات
export interface Coordinates {
  lat: number;
  lng: number;
}

// Base Entity
export interface Entity<T = unknown> {
  id: EntityId;
  city_id: CityId;
  created_at: Date;
  updated_at: Date;
}

// Domain Events
export interface DomainEvent<T = unknown> {
  type: string;
  payload: T;
  occurred_at: Date;
}
