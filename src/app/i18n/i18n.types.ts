export type AppLang = 'en' | 'hy' | 'ru';

export const SUPPORTED_LANGS: AppLang[] = ['en', 'hy', 'ru'];

export const DEFAULT_LANG: AppLang = 'en';

export interface LangOption {
  code: AppLang;
  nativeLabel: string;
}

export const LANG_OPTIONS: LangOption[] = [
  { code: 'en', nativeLabel: 'English' },
  { code: 'hy', nativeLabel: 'Հայերեն' },
  { code: 'ru', nativeLabel: 'Русский' },
];

/** Arbitrarily nested string dictionary - leaves are translation strings. */
export type TranslationDict = { [key: string]: string | TranslationDict };