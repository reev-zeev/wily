/**
 * الغرض: دعم اللغات والترجمة
 * الحالة: تنفيد فعلي
 * ينتمي إلى: shared/i18n
 */

import type { Language } from '@shared/kernel';

// Re-export translation utilities
export {
  t,
  getAvailableLanguages,
  isValidLanguage,
  buildLanguageKeyboard,
  getLanguageName,
  type MessageKey,
} from './translation';

export { messages } from './translation';

export type Messages = Record<Language, Record<string, string>>;

export interface I18nService {
  t(key: string, lang: Language, params?: Record<string, string | number>): string;
  setLanguage(lang: Language): void;
}

export function createI18nService(): I18nService {
  return {
    t(key: string, lang: Language, params?: Record<string, string | number>): string {
      // Delegate to translation module
      const { t } = require('./translation');
      return t(key as any, lang, params);
    },
    setLanguage(_lang: Language): void {
      // Language is stored per-user in DB
    },
  };
}
