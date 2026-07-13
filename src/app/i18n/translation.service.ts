import { Injectable, computed, signal } from '@angular/core';
import { AppLang, DEFAULT_LANG, LANG_OPTIONS, SUPPORTED_LANGS, TranslationDict } from './i18n.types';
import { EN } from './translations/en';
import { HY } from './translations/hy';
import { RU } from './translations/ru';

const LANG_STORAGE_KEY = 'app_lang';

const DICTS: Record<AppLang, TranslationDict> = { en: EN, hy: HY, ru: RU };

function isAppLang(value: string | null): value is AppLang {
  return !!value && (SUPPORTED_LANGS as string[]).includes(value);
}

/** Only trusts a browser language it can map unambiguously; anything else safely falls back to English. */
function detectBrowserLang(): AppLang {
  const navigatorLang = typeof navigator !== 'undefined' ? navigator.language : '';
  const normalized = navigatorLang.toLowerCase();

  if (normalized.startsWith('hy')) {
    return 'hy';
  }
  if (normalized.startsWith('ru')) {
    return 'ru';
  }
  return DEFAULT_LANG;
}

function resolveInitialLang(): AppLang {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(LANG_STORAGE_KEY) : null;

  if (isAppLang(stored)) {
    return stored;
  }
  return detectBrowserLang();
}

function readPath(dict: TranslationDict, path: string[]): string | undefined {
  let node: string | TranslationDict = dict;

  for (const segment of path) {
    if (typeof node !== 'object' || node === null || !(segment in node)) {
      return undefined;
    }
    node = node[segment];
  }

  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }
  return Object.keys(params).reduce(
    (result, key) => result.replaceAll(`{${key}}`, String(params[key])),
    template,
  );
}

/**
 * Lightweight, dependency-free i18n: the app only ever needs 3 static, fully-known
 * languages switched at runtime, so a signal-backed dictionary lookup avoids pulling in
 * ngx-translate (async HTTP loading, FOUC on first paint) for a problem this small.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {

  readonly languages = LANG_OPTIONS;

  private langSignal = signal<AppLang>(resolveInitialLang());

  lang = computed(() => this.langSignal());

  private dict = computed(() => DICTS[this.langSignal()]);

  setLang(lang: AppLang): void {
    if (!isAppLang(lang)) {
      return;
    }
    this.langSignal.set(lang);
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  }

  /** Looks up `key` (dot path, e.g. "orders.success.assigned") in the active language, falling back to English, then the key itself. */
  t(key: string, params?: Record<string, string | number>): string {
    const path = key.split('.');
    const value = readPath(this.dict(), path) ?? readPath(EN, path) ?? key;
    return interpolate(value, params);
  }
}