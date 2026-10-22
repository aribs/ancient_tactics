// Colocación en cuadrícula compartida por las IA de despliegue del rival.
// Melee y caballería ocupan las celdas más adelantadas; los arqueros, las
// de retaguardia.

import { cells } from '../deploy/grid';
import type { PlacedUnit, UnitType } from '../sim/types';
import type { DeployContext } from './DeploymentAI';

export function placeRival(ctx: DeployContext, porColocar: UnitType[]): PlacedUnit[] {
  const placed: PlacedUnit[] = [];

  // Para el rival, la columna 0 es la más pegada a su base (retaguardia);
  // la columna mayor es la más avanzada hacia el jugador.
  const celdas = cells(ctx.field, 'rival');
  const frente = [...celdas].sort((a, b) => b.col - a.col || a.row - b.row);
  const retaguardia = [...celdas].sort((a, b) => a.col - b.col || a.row - b.row);

  const arqueros = porColocar.filter((t) => t === 'arquero');
  const resto = porColocar.filter((t) => t !== 'arquero');

  const usadas = new Set<number>();
  let fi = 0;
  for (const t of resto) {
    while (fi < frente.length && usadas.has(frente[fi].index)) fi++;
    if (fi >= frente.length) break;
    const c = frente[fi++];
    usadas.add(c.index);
    placed.push({ type: t, team: 'rival', x: c.x, y: c.y });
  }
  let ri = 0;
  for (const t of arqueros) {
    while (ri < retaguardia.length && usadas.has(retaguardia[ri].index)) ri++;
    if (ri >= retaguardia.length) break;
    const c = retaguardia[ri++];
    usadas.add(c.index);
    placed.push({ type: t, team: 'rival', x: c.x, y: c.y });
  }
  return placed;
}
