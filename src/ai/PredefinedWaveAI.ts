// IA rival de NIVEL 1: oleadas predefinidas.
//
// Lee la composición fija de la oleada (waves.json) y coloca esas unidades en
// las celdas de su cuadrícula. No observa al jugador ni usa azar en la
// composición; solo reparte las unidades por sus celdas de forma ordenada.

import type { PlacedUnit, UnitType } from '../sim/types';
import type { DeployContext, DeploymentAI } from './DeploymentAI';
import { placeRival } from './placement';

export class PredefinedWaveAI implements DeploymentAI {
  readonly nombre = 'Nivel 1 · Oleadas predefinidas';

  deploy(ctx: DeployContext): PlacedUnit[] {
    const composicion = ctx.wave.rival;
    const porColocar: UnitType[] = [];
    (Object.keys(composicion) as UnitType[]).forEach((t) => {
      const n = composicion[t] ?? 0;
      for (let i = 0; i < n; i++) porColocar.push(t);
    });
    return placeRival(ctx, porColocar);
  }
}
