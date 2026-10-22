// Postura del ejército del jugador. En ataque las unidades marchan hacia la
// base rival; en defensa se repliegan en formación compacta y esperan al
// enemigo. Sin Phaser: la usan la simulación y la previsualización.

import { gridCenter } from '../deploy/grid';
import type { Battlefield } from './types';

export type Stance = 'ataque' | 'defensa';

const COMPACT = 0.6;
const RETREAT_X = -25;

/** Alcance máximo (desde su puesto) al que una unidad en defensa sale a combatir. */
export const DEFENSE_LEASH = 170;

/** Puesto defensivo de una unidad colocada en (x,y): más junta y más atrás. */
export function defensiveAnchor(
  field: Battlefield,
  x: number,
  y: number,
): { x: number; y: number } {
  // La formación se encoge hacia el centro de la cuadrícula del jugador.
  const c = gridCenter(field);
  return {
    x: c.x + (x - c.x) * COMPACT + RETREAT_X,
    y: c.y + (y - c.y) * COMPACT,
  };
}

/** Formación cerrada: daño recibido por una unidad en defensa que está en su puesto. */
export const DEFENSE_DAMAGE_TAKEN = 0.7;
