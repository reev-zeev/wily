/**
 * الغرض: نظام الترجمة والاختيار بين اللغات
 * الحالة: تنفيد فعلي
 * ينتمي إلى: packages/shared/i18n
 * 
 * اللغات المدعومة:
 * - ar: العربية
 * - en: الإنجليزية  
 * - ur: الأردية
 * 
 * يمكن إضافة لغات جديدة عبر platform_settings.additional_languages
 */

import type { Language } from '@shared/kernel';

// ══════════════════════════════════════════════════════════════════
// TRANSLATION MESSAGES
// ══════════════════════════════════════════════════════════════════

export const messages = {
  // Onboarding
  'welcome.ar': 'مرحباً بك في وصلة! 🚗',
  'welcome.en': 'Welcome to Wusla! 🚗',
  'welcome.ur': 'وصلہ میں خوش آمدید! 🚗',

  'choose_language.ar': 'اختر لغتك المفضلة:',
  'choose_language.en': 'Choose your preferred language:',
  'choose_language.ur': 'اپنی ترجیحی زبان منتخب کریں:',

  'language_set.ar': 'تم اختيار اللغة العربية ✓',
  'language_set.en': 'English has been set ✓',
  'language_set.ur': 'اردو منتخب ہو گئی ہے ✓',

  // Driver Bot
  'driver.register.name.ar': 'أرسل اسمك الكامل:',
  'driver.register.name.en': 'Send your full name:',
  'driver.register.name.ur': 'اپنا پورا نام بھیجیں:',

  'driver.register.city.ar': 'اختر مدينتك:',
  'driver.register.city.en': 'Choose your city:',
  'driver.register.city.ur': 'اپنا شہر منتخب کریں:',

  'driver.registration.success.ar': '✅ تم التسجيل بنجاح!',
  'driver.registration.success.en': '✅ Registration successful!',
  'driver.registration.success.ur': '✅ رجسٹریشن کامیاب!',

  'driver.menu.available.ar': '🟢 متاح',
  'driver.menu.available.en': '🟢 Available',
  'driver.menu.available.ur': '🟢 دستیاب',

  'driver.menu.unavailable.ar': '🔴 غير متاح',
  'driver.menu.unavailable.en': '🔴 Unavailable',
  'driver.menu.unavailable.ur': '🔴 دستیاب نہیں',

  'driver.status.available.ar': 'حالتك الآن: متاح',
  'driver.status.available.en': 'Your status is now: Available',
  'driver.status.available.ur': 'آپ کی صورتحال: دستیاب',

  'driver.status.unavailable.ar': 'حالتك الآن: غير متاح',
  'driver.status.unavailable.en': 'Your status is now: Unavailable',
  'driver.status.unavailable.ur': 'آپ کی صورتحال: دستیاب نہیں',

  // Subscription
  'subscription.choose_plan.ar': 'اختر باقتك:',
  'subscription.choose_plan.en': 'Choose your plan:',
  'subscription.choose_plan.ur': 'اپنی پلان منتخب کریں:',

  'subscription.ride_only.ar': 'مشاوير فقط - {price} ر.س/شهر',
  'subscription.ride_only.en': 'Rides Only - {price} SAR/month',
  'subscription.ride_only.ur': 'صرف سواری - {price} روپے/ماہ',

  'subscription.delivery_only.ar': 'توصيل فقط - {price} ر.س/شهر',
  'subscription.delivery_only.en': 'Delivery Only - {price} SAR/month',
  'subscription.delivery_only.ur': 'صرف ڈلیوری - {price} روپے/ماہ',

  'subscription.both.ar': 'كلاهما - {price} ر.س/شهر',
  'subscription.both.en': 'Both - {price} SAR/month',
  'subscription.both.ur': 'دونوں - {price} روپے/ماہ',

  'subscription.trial_active.ar': 'لديك شهر مجاني! ينتهي في {date}',
  'subscription.trial_active.en': 'You have a free month! Ends on {date}',
  'subscription.trial_active.ur': 'آپ کے پاس مفت مہینہ ہے! {date} کو ختم ہوگا',

  'subscription.renewed.ar': '✅ تم تجديد الاشتراك بنجاح!',
  'subscription.renewed.en': '✅ Subscription renewed successfully!',
  'subscription.renewed.ur': '✅ سبسکرپشن کامیابی سے تجدید ہو گئی!',

  'subscription.expired.ar': '⚠️ انتهى اشتراكك. يرجى التجديد.',
  'subscription.expired.en': '⚠️ Your subscription has expired. Please renew.',
  'subscription.expired.ur': '⚠️ آپ کا سبسکرپشن ختم ہو گیا ہے۔ براہ کرم تجدید کریں۔',

  // Requests
  'request.searching.ar': '🔍 جاري البحث عن سائق...',
  'request.searching.en': '🔍 Searching for a driver...',
  'request.searching.ur': '🔍 ڈرائیور کی تلاش ہو رہی ہے...',

  'request.offer_received.ar': '📍 عرض جديد من {name}!\nالمسافة: {distance} كم\nالتقييم: ⭐ {rating}',
  'request.offer_received.en': '📍 New offer from {name}!\nDistance: {distance} km\nRating: ⭐ {rating}',
  'request.offer_received.ur': '📍 {name} سے نیا آفر!\nفاصلہ: {distance} کلومیٹر\nریٹنگ: ⭐ {rating}',

  'request.accepted.ar': '✅ تم قبول العرض!',
  'request.accepted.en': '✅ Offer accepted!',
  'request.accepted.ur': '✅ آفر قبول ہو گیا!',

  'request.driver_arrived.ar': '🚗 السائق وصل!',
  'request.driver_arrived.en': '🚗 Driver has arrived!',
  'request.driver_arrived.ur': '🚗 ڈرائیور آ گیا ہے!',

  'request.in_progress.ar': '🚙 الرحلة جارية...',
  'request.in_progress.en': '🚙 Trip in progress...',
  'request.in_progress.ur': '🚙 سفر جاری ہے...',

  'request.completed.ar': '✅ تمت الرحلة! كيف كانت تجربتك؟',
  'request.completed.en': '✅ Trip completed! How was your experience?',
  'request.completed.ur': '✅ سفر مکمل ہو گیا! آپ کا تجربہ کیسا رہا؟',

  'request.cancelled.ar': '❌ تم إلغاء الرحلة',
  'request.cancelled.en': '❌ Trip cancelled',
  'request.cancelled.ur': '❌ سفر منسوخ ہو گیا',

  'request.no_driver.ar': '⚠️ لم يتم العثور على سائق. جاري المحاولة مجدداً...',
  'request.no_driver.en': '⚠️ No driver found. Retrying...',
  'request.no_driver.ur': '⚠️ کوئی ڈرائیور نہیں ملا۔ دوبارہ کوشش کر رہے ہیں...',

  // Rating
  'rating.prompt.ar': 'قيّم تجربتك:',
  'rating.prompt.en': 'Rate your experience:',
  'rating.prompt.ur': 'اپنے تجربے کی درجہ بندی کریں:',

  'rating.thanks.ar': 'شكراً على تقييمك! 🙏',
  'rating.thanks.en': 'Thank you for your rating! 🙏',
  'rating.thanks.ur': 'آپ کی درجہ بندی کا شکریہ! 🙏',

  // Errors
  'error.generic.ar': 'حدث خطأ. يرجى المحاولة لاحقاً.',
  'error.generic.en': 'An error occurred. Please try again later.',
  'error.generic.ur': 'ایک خرابی پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔',

  'error.not_registered.ar': 'يرجى التسجيل أولاً باستخدام /start',
  'error.not_registered.en': 'Please register first using /start',
  'error.not_registered.ur': 'براہ کرم پہلے /start سے رجسٹر کریں',

  'error.not_subscribed.ar': 'اشتراكك غير نشط. يرجى الاشتراك.',
  'error.not_subscribed.en': 'Your subscription is inactive. Please subscribe.',
  'error.not_subscribed.ur': 'آپ کا سبسکرپشن غیر فعال ہے۔ براہ کرم سبسکرائب کریں۔',
} as const;

// ══════════════════════════════════════════════════════════════════
// TRANSLATION FUNCTION
// ══════════════════════════════════════════════════════════════════

export type MessageKey = keyof typeof messages;

/**
 * Get translated message for a key
 */
export function t(key: string, lang: Language, params?: Record<string, string | number>): string {
  // Keys are in format "key.lang" e.g., "welcome.ar"
  const keyWithLang = `${key}.${lang}` as keyof typeof messages;
  const keyFallback = `${key}.ar` as keyof typeof messages;

  let message = (messages as any)[keyWithLang] ?? (messages as any)[keyFallback] ?? key;

  // Replace placeholders
  if (params && typeof message === 'string') {
    for (const [param, value] of Object.entries(params)) {
      message = message.replace(`{${param}}`, String(value));
    }
  }

  return message;
}

/**
 * Get all available languages
 */
export function getAvailableLanguages(): { code: Language; name: string }[] {
  return [
    { code: 'ar', name: 'العربية' },
    { code: 'en', name: 'English' },
    { code: 'ur', name: 'اردو' },
  ];
}

/**
 * Detect language from code
 */
export function isValidLanguage(code: string): code is Language {
  return ['ar', 'en', 'ur'].includes(code);
}

/**
 * Build language selection keyboard
 */
export function buildLanguageKeyboard(): { text: string; callback_data: string }[] {
  return getAvailableLanguages().map((lang) => ({
    text: lang.name,
    callback_data: `set_language:${lang.code}`,
  }));
}

/**
 * Get language name
 */
export function getLanguageName(lang: Language): string {
  const langInfo = getAvailableLanguages().find((l) => l.code === lang);
  return langInfo?.name ?? lang;
}
