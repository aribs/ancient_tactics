// Carga y acceso a los datos de equilibrio. Importa los JSON directamente
// (Vite y tsx resuelven resolveJsonModule), de modo que tocar los JSON no
// obliga a recompilar la lógica.

import unitsJson from '../data/units.json';
import wavesJson from '../data/waves.json';
import type { Battlefield, UnitTable, UnitType } from './types';

export const UNITS = unitsJson as unknown as UnitTable;

export const UNIT_TYPES: UnitType[] = ['legionario', 'arquero', 'caballeria', 'elefante'];

/** Tipos que el jugador puede desplegar en la oleada `waveId`. */
export function unlockedTypes(waveId: number): UnitType[] {
  return UNIT_TYPES.filter((t) => waveId >= (UNITS[t].desbloqueoOleada ?? 1));
}

export interface WaveDef {
  id: number;
  nombre: string;
  presupuestoJugador: number;
  /** Tamaño del tablero: `alto` es la zona de juego (sin franjas de HUD). */
  campo: { ancho: number; alto: number; columnas: number; filas: number };
  /** Rango de accidentes de terreno que se generan en el tablero. */
  terreno: { min: number; max: number };
  rival: Partial<Record<UnitType, number>>;
}

export interface WavesFile {
  bonusVictoria: number;
  oleadas: WaveDef[];
}

export const WAVES = wavesJson as unknown as WavesFile;

/** Franja de HUD sobre y bajo la zona de juego. */
export const HUD_BAND = 100;

/** Campo de batalla de una oleada: el tablero crece con el nivel. */
export function fieldFor(wave: WaveDef): Battlefield {
  const { ancho, alto, columnas, filas } = wave.campo;
  const height = alto + HUD_BAND * 2;
  return {
    width: ancho,
    height,
    playTop: HUD_BAND,
    playBottom: HUD_BAND + alto,
    midY: height / 2,
    cols: columnas,
    rows: filas,
  };
}

/** Coste de desplegar un conjunto de unidades, por tipo y cantidad. */
export function costeDe(composicion: Partial<Record<UnitType, number>>): number {
  let total = 0;
  for (const t of UNIT_TYPES) {
    const n = composicion[t] ?? 0;
    total += n * UNITS[t].cost;
  }
  return total;
}
