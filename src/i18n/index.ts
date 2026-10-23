// i18n mínimo, sin dependencias: diccionarios planos tipados (es es la
// referencia) y el idioma elegido se recuerda en localStorage.

import { en } from './en';
import { es, type Dict } from './es';
import type { UnitType } from '../sim/types';

export type Lang = 'es' | 'en';
export type Key = keyof Dict;

const DICTS: Record<Lang, Dict> = { es, en };
const STORAGE_KEY = 'lang';

function detect(): Lang {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    // Almacenamiento no disponible (modo privado, etc.): se usa el del navegador.
  }
  return globalThis.navigator?.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let current: Lang = detect();

export const getLang = (): Lang => current;

export function t(key: Key, params?: Record<string, string | number>): string {
  const text = DICTS[current][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/** Textos fuera del lienzo (título de la pestaña, aviso de girar el móvil). */
function applyDocument(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = current;
  document.title = t('doc.title');
  const girar = document.getElementById('girar-texto');
  if (girar) girar.textContent = t('doc.rotate');
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    // Sin almacenamiento: el idioma solo dura la sesión.
  }
  applyDocument();
}

export const toggleLang = (): void => setLang(current === 'es' ? 'en' : 'es');

/** Aplica el idioma inicial al documento HTML. */
export const initI18n = applyDocument;

export const unitName = (type: UnitType): string => t(`unit.${type}.name` as Key);

/** Nombre abreviado para botones y tablas estrechos. */
export function unitShortName(type: UnitType): string {
  const short = `unit.${type}.short` as Key;
  return short in es ? t(short) : unitName(type);
}

export const waveName = (id: number): string => t(`wave.${id}.name` as Key);
