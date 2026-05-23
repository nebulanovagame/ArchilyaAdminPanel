import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from '../locales/tr.json';
import en from '../locales/en.json';

const LANGUAGE_STORAGE_KEY = 'archilya.language';

export const supportedLngs = ['tr', 'en'] as const;
export type SupportedLanguage = (typeof supportedLngs)[number];

const resources = {
  tr: { translation: tr },
  en: { translation: en },
} as const;

function resolveDeviceLanguage(): SupportedLanguage {
  const locales = getLocales();
  for (const locale of locales) {
    const code = locale.languageCode;
    if (code && supportedLngs.includes(code as SupportedLanguage)) {
      return code as SupportedLanguage;
    }
  }
  return 'tr';
}

const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  init: () => {},
  detect: async (callback: (language: string) => void) => {
    try {
      const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored && supportedLngs.includes(stored as SupportedLanguage)) {
        callback(stored);
        return;
      }
    } catch {
      // ignore storage errors
    }
    callback(resolveDeviceLanguage());
  },
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore storage errors
    }
  },
};

void i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: [...supportedLngs],
    fallbackLng: 'tr',
    returnNull: false,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
