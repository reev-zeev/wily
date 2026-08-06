/**
 * الغرض: دعم اللغات والترجمة
 * الحالة: تنفيد فعلي — أساس تقني بحت (ملفات الرسائل تُفعَّل لاحقاً)
 * ينتمي إلى: shared/i18n
 */

import type { Language } from '@wasla/shared/kernel';

export type MessageKey =
  | 'welcome'
  | 'choose_language'
  | 'driver_register'
  | 'rider_register'
  | 'subscription_choose'
  | 'subscription_trial'
  | 'subscription_paid'
  | 'available'
  | 'unavailable'
  | 'ride_request'
  | 'delivery_request'
  | 'offer_received'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'trip_started'
  | 'trip_completed'
  | 'rate_driver'
  | 'rate_rider'
  | 'sos_activated'
  | 'support_opened'
  | 'error_generic'
  | 'error_not_found'
  | 'error_unauthorized';

export type Messages = Record<MessageKey, string>;

export interface I18nService {
  t(key: MessageKey, lang: Language): string;
  setLanguage(lang: Language): void;
}

export function createI18nService(messages: Record<Language, Messages>): I18nService {
  return {
    t(key: MessageKey, lang: Language): string {
      const langMessages = messages[lang] ?? messages['ar'];
      return langMessages[key] ?? key;
    },
    setLanguage(_lang: Language): void {
      // سيتم تفعيل التبديل عند تفعيل i18n-translation
    },
  };
}
