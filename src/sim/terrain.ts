// Accidentes de terreno: tipos (data-driven en terrain.json), generación
// procedural determinista desde una semilla, y geometría de consulta. Sin
// Phaser: la simulación los usa y el renderizador solo los dibuja.

import terrainJson from '../data/terrain.json';
import { cellCenter, CELL_HALF_W } from '../deploy/grid';
import { Rng } from './rng';
import type { Battlefield } from './types';

export type TerrainKind = 'roca' | 'bosque' | 'barro';

export interface TerrainStats {
  id: TerrainKind;
  nombre: string;
  /** No se puede atravesar; las unidades la rodean. */
  impassable: boolean;
  /** Bloquea la línea de visión (las flechas no pasan). */
  blocksLoS: boolean;
  /** Multiplicador de velocidad al estar dentro (<1 ralentiza). */
  speedMult: number;
  /** Multiplicador de daño a distancia recibido por quien está dentro (cobertura). */
  rangedDamageMult: number;
  color: string;
  minRadius: number;
  maxRadius: number;
  /** Peso relativo en la generación aleatoria. */
  peso: number;
}

export type TerrainTable = Record<TerrainKind, TerrainStats>;

export const TERRAIN = terrainJson as unknown as TerrainTable;
export const TERRAIN_KINDS: TerrainKind[] = ['roca', 'bosque', 'barro'];

export interface TerrainFeature {
  kind: TerrainKind;
  x: number;
  y: number;
  radius: number;
}

// El terreno solo aparece en la banda central, calculada para no solapar nunca
// las celdas de despliegue de ninguno de los dos bandos.
const MAX_R = Math.max(...TERRAIN_KINDS.map((k) => TERRAIN[k].maxRadius));
const PAD = 8;
/** Margen vertical respecto a los bordes de la zona de juego. */
const EDGE = 20;

/**
 * Genera los accidentes de terreno de forma determinista a partir de la
 * semilla. La misma semilla produce siempre el mismo mapa, de modo que la
 * previsualización del despliegue y la batalla coinciden. `cantidad` es el
 * rango [min, max] de accidentes, que crece con el tamaño del tablero.
 */
export function generateTerrain(
  seed: number,
  field: Battlefield,
  cantidad: { min: number; max: number },
): TerrainFeature[] {
  const xMin = cellCenter(field, 'jugador', field.cols - 1, 0).x + CELL_HALF_W + MAX_R + PAD;
  const xMax = cellCenter(field, 'rival', field.cols - 1, 0).x - CELL_HALF_W - MAX_R - PAD;
  const yMin = field.playTop + EDGE;
  const yMax = field.playBottom - EDGE;

  // RNG propio (independiente del de combate) para no acoplar el orden de
  // consumo de números aleatorios con la simulación.
  const rng = new Rng((seed ^ 0x9e3779b9) >>> 0);
  const count = rng.int(cantidad.min, cantidad.max);
  const features: TerrainFeature[] = [];

  let intentos = 0;
  while (features.length < count && intentos < count * 30) {
    intentos++;
    const kind = pickKind(rng);
    const stats = TERRAIN[kind];
    const radius = rng.range(stats.minRadius, stats.maxRadius);
    const x = rng.range(xMin, xMax);
    const y = rng.range(yMin + radius, yMax - radius);

    // No solapar con accidentes ya colocados (deja un pasillo entre ellos).
    const solapa = features.some((f) => {
      const d = Math.hypot(f.x - x, f.y - y);
      return d < f.radius + radius + 16;
    });
    if (solapa) continue;

    features.push({ kind, x, y, radius });
  }

  return features;
}

function pickKind(rng: Rng): TerrainKind {
  const total = TERRAIN_KINDS.reduce((s, k) => s + TERRAIN[k].peso, 0);
  let r = rng.range(0, total);
  for (const k of TERRAIN_KINDS) {
    r -= TERRAIN[k].peso;
    if (r <= 0) return k;
  }
  return 'roca';
}

// --- Consultas de geometría ------------------------------------------------

/** ¿El punto (x,y) está dentro del accidente f? */
export function pointInFeature(f: TerrainFeature, x: number, y: number): boolean {
  return (x - f.x) * (x - f.x) + (y - f.y) * (y - f.y) <= f.radius * f.radius;
}

/** ¿El segmento A→B corta el círculo (cx,cy,r)? (línea de visión) */
export function segmentIntersectsCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  // Proyección del centro sobre el segmento, acotada a [0,1].
  let t = len2 > 0 ? ((cx - ax) * dx + (cy - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + t * dx;
  const py = ay + t * dy;
  const dist2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
  return dist2 <= r * r;
}
