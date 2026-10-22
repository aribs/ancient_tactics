// Geometría de las cuadrículas de despliegue. Sin Phaser: la usan tanto la
// escena del jugador como la IA rival para colocar unidades en celdas. El
// tamaño de la cuadrícula depende del campo (crece con el nivel).

import type { Battlefield, Team } from '../sim/types';

/** Posición de la primera columna (desde el borde) y separaciones. */
const COL_GAP = 70;
const ROW_GAP = 72;
const PLAYER_FIRST_COL_X = 130;

export interface Cell {
  index: number;
  col: number;
  row: number;
  x: number;
  y: number;
}

/** Centro de la celda (col,row) para un equipo. El rival se espeja en X. */
export function cellCenter(
  field: Battlefield,
  team: Team,
  col: number,
  row: number,
): { x: number; y: number } {
  const topY = field.midY - ((field.rows - 1) * ROW_GAP) / 2;
  const y = topY + row * ROW_GAP;
  const playerX = PLAYER_FIRST_COL_X + col * COL_GAP;
  const x = team === 'jugador' ? playerX : field.width - playerX;
  return { x, y };
}

/** Todas las celdas de la cuadrícula de un equipo, en orden de índice. */
export function cells(field: Battlefield, team: Team): Cell[] {
  const out: Cell[] = [];
  let index = 0;
  for (let row = 0; row < field.rows; row++) {
    for (let col = 0; col < field.cols; col++) {
      const c = cellCenter(field, team, col, row);
      out.push({ index, col, row, x: c.x, y: c.y });
      index++;
    }
  }
  return out;
}

/** Centro de la cuadrícula del jugador. */
export function gridCenter(field: Battlefield): { x: number; y: number } {
  return { x: PLAYER_FIRST_COL_X + ((field.cols - 1) * COL_GAP) / 2, y: field.midY };
}

/** Medio ancho/alto de celda, para dibujar y para detectar clics. */
export const CELL_HALF_W = COL_GAP / 2;
export const CELL_HALF_H = ROW_GAP / 2;
