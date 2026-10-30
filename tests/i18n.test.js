import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../src/i18n/en';
import { detectLanguage, getLanguage, locale, resolveLanguage, setCurrentLanguage, tr, trc, translated } from '../src/i18n';

afterEach(() => setCurrentLanguage('it'));

const files = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : /\.jsx?$/.test(name) ? [path] : [];
});
// Literal keys only: tr(variable) calls translate data already in the dictionary.
const literal = /\btr\(\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g;
const scoped = /\btrc\(\s*'(\w+)',\s*('(?:[^'\\]|\\.)*')/g;
const unquote = s => JSON.parse(s[0] === '"' ? s : `"${s.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"`);

describe('i18n', () => {
  it('detects the language from the browser preferences, falling back to Italian', () => {
    expect(detectLanguage(['en-US', 'it-IT'])).toBe('en');
    expect(detectLanguage(['de-DE', 'it'])).toBe('it');
    expect(detectLanguage(['fr-FR'])).toBe('it');
    expect(detectLanguage([])).toBe('it');
    expect(resolveLanguage(null, ['en-GB'])).toBe('en');
    expect(resolveLanguage('it', ['en-GB'])).toBe('it');
    expect(resolveLanguage('xx', ['en'])).toBe('en');
  });

  it('translates, interpolates and falls back to the Italian key', () => {
    expect(getLanguage()).toBe('it');
    expect(tr('Settimana {week} · scegli tu', { week: 2 })).toBe('Settimana 2 · scegli tu');
    setCurrentLanguage('en');
    expect(locale()).toBe('en-GB');
    expect(tr('Settimana {week} · scegli tu', { week: 2 })).toBe('Week 2 · your choice');
    expect(tr('Testo senza traduzione')).toBe('Testo senza traduzione');
    expect(trc('undo', 'Annulla')).toBe('Undo');
    expect(tr('Annulla')).toBe('Cancel');
  });

  it('keeps translated lists in sync with the current language', () => {
    const [item] = translated([{ id: 'a', label: 'Annulla' }]);
    expect(item.label).toBe('Annulla');
    setCurrentLanguage('en');
    expect(item.label).toBe('Cancel');
  });

  it('has an English entry for every literal key used in the app', () => {
    const missing = [];
    for (const file of files(fileURLToPath(new URL('../src', import.meta.url)))) {
      const source = readFileSync(file, 'utf8');
      for (const [, key] of source.matchAll(literal)) if (!(unquote(key) in en)) missing.push(`${file}: ${unquote(key)}`);
      for (const [, context, key] of source.matchAll(scoped)) if (!(`${context}|${unquote(key)}` in en)) missing.push(`${file}: ${context}|${unquote(key)}`);
    }
    expect(missing).toEqual([]);
  });
});
