import en from './en';

// Italian is the source language: UI strings are written in Italian and used
// as keys, so a missing translation falls back to the original text.
export const LANGUAGES = [
  { id: 'it', name: 'Italiano', locale: 'it-IT' },
  { id: 'en', name: 'English', locale: 'en-GB' },
];
export const DEFAULT_LANGUAGE = 'it';
const DICTIONARIES = { en };

const supported = id => LANGUAGES.some(l => l.id === id);

// `preferred` is an Accept-Language style list (navigator.languages mirrors the
// header the browser sends): the first supported base language wins.
export function detectLanguage(preferred = []) {
  for (const tag of preferred) {
    const base = String(tag || '').toLowerCase().split(/[-_]/)[0];
    if (supported(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

const browserLanguages = () => {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
};

// `choice` is the language picked in the Profile, null means "follow the browser".
export const resolveLanguage = (choice, preferred = browserLanguages()) => supported(choice) ? choice : detectLanguage(preferred);

let current = DEFAULT_LANGUAGE;
export const getLanguage = () => current;
export const setCurrentLanguage = id => { current = supported(id) ? id : DEFAULT_LANGUAGE; };
export const locale = () => LANGUAGES.find(l => l.id === current).locale;

export function tr(key, vars) {
  const text = DICTIONARIES[current]?.[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match)) : text;
}

export function bindLanguage(store, element = document.documentElement) {
  const apply = () => { setCurrentLanguage(resolveLanguage(store.getState().language)); element.lang = current; };
  apply();
  return store.subscribe((state, previous) => { if (state.language !== previous.language) apply(); });
}

// Module-level lists are built once, before the language is known: their text
// fields become getters, so they are translated each time they are read.
// Same word, different meaning: a context-scoped entry ("context|key") wins
// over the plain key, which stays the Italian fallback.
export function trc(context, key, vars) {
  const scoped = DICTIONARIES[current]?.[`${context}|${key}`];
  return scoped == null ? tr(key, vars) : tr(scoped, vars);
}
export function translated(list, fields = ['label']) {
  return list.map(item => {
    const out = { ...item };
    for (const field of fields) {
      if (field in item) Object.defineProperty(out, field, { get: () => tr(item[field]), enumerable: true });
    }
    return out;
  });
}
