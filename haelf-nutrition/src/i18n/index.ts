import type { AppLocale } from '../domain/types';
import { en } from './en';
import { zhTW } from './zh-TW';

type Dictionary = Record<string, unknown>;

const dictionaries: Record<AppLocale, Dictionary> = {
  en: en as unknown as Dictionary,
  'zh-TW': zhTW as unknown as Dictionary,
};

function lookup(dictionary: Dictionary, key: string): string | null {
  let current: unknown = dictionary;
  for (const segment of key.split('.')) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Dictionary)[segment];
  }
  return typeof current === 'string' ? current : null;
}

export function translate(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number>
): string {
  const template =
    lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key) ?? key;
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(params[name] ?? `{{${name}}}`)
  );
}
