/**
 * Minimal DE/EN i18n for the UI.
 *
 * - Language resolves in this order: explicit localStorage → browser language
 *   (de → 'de', otherwise 'en') → 'en'.
 * - The UI re-renders through `useLang()` (a store + useSyncExternalStore).
 * - Parameter labels/help keep their English strings in `engine/params.ts` and
 *   are localized through `labelOf`/`helpOf` — params.ts stays the single
 *   source of truth (no key is ever duplicated elsewhere).
 */

import { useSyncExternalStore } from 'react';

export type Lang = 'de' | 'en';

const LANG_KEY = 'buyvsrent.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'de' || saved === 'en') return saved;
  } catch {
    // storage unavailable
  }
  return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

let current: Lang = initialLang();
document.documentElement.lang = current === 'de' ? 'de' : 'en';

const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore — best effort
  }
  document.documentElement.lang = lang;
  listeners.forEach((f) => f());
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Reactive language for components. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang);
}

/** Pick the entry for the active language (falls back to the English string). */
export function pick(lang: Lang, en: string, de: string | undefined): string {
  return lang === 'de' && de ? de : en;
}
