// IA rival de NIVEL 2: aleatorio con reglas.
//
// Gasta el mismo presupuesto que costaría la composición predefinida de la
// oleada, pero lo reparte con pesos aleatorios (deterministas por semilla).
// Las reglas evitan ejércitos absurdos: una primera línea mínima, topes de
// presupuesto para arqueros, caballería y elefantes, y los tipos solo
// aparecen cuando el rival los tiene desbloqueados.

import { costeDe, UNITS, UNIT_TYPES } from '../sim/data';
import { Rng } from '../sim/rng';
import type { PlacedUnit, UnitType } from '../sim/types';
import type { DeployContext, DeploymentAI } from './DeploymentAI';
import { placeRival } from './placement';

/** Peso base de cada tipo; se multiplica por un factor aleatorio por oleada. */
const PESO_BASE: Record<UnitType, number> = {
  legionario: 1,
  arquero: 1,
  caballeria: 0.6,
  elefante: 0.25,
};

/** Fracción máxima del presupuesto que puede ir a cada tipo (por defecto 1). */
const TOPE_PRESUPUESTO: Partial<Record<UnitType, number>> = {
  arquero: 0.45,
  caballeria: 0.35,
  elefante: 0.35,
};

/** Fracción mínima del presupuesto destinada a primera línea. */
const MIN_PRIMERA_LINEA = 0.25;
const PRIMERA_LINEA: UnitType[] = ['legionario', 'elefante'];

export class RandomRulesAI implements DeploymentAI {
  readonly nombre = 'Nivel 2 · Aleatorio con reglas';

  deploy(ctx: DeployContext): PlacedUnit[] {
    const rng = new Rng(ctx.seed ^ 0x2a9f3c11);
    const presupuesto = costeDe(ctx.wave.rival);
    const aforo = ctx.field.cols * ctx.field.rows;

    const disponibles = UNIT_TYPES.filter(
      (t) => ctx.wave.id >= (UNITS[t].desbloqueoRival ?? UNITS[t].desbloqueoOleada ?? 1),
    );
    const peso = new Map<UnitType, number>(
      disponibles.map((t) => [t, PESO_BASE[t] * rng.range(0.4, 1.6)]),
    );

    const gastado: Partial<Record<UnitType, number>> = {};
    const elegidas: UnitType[] = [];
    let resto = presupuesto;

    const comprar = (t: UnitType): void => {
      elegidas.push(t);
      gastado[t] = (gastado[t] ?? 0) + UNITS[t].cost;
      resto -= UNITS[t].cost;
    };
    const puede = (t: UnitType): boolean =>
      UNITS[t].cost <= resto &&
      ((gastado[t] ?? 0) + UNITS[t].cost) / presupuesto <= (TOPE_PRESUPUESTO[t] ?? 1);
    const elegirPonderado = (tipos: UnitType[]): UnitType => {
      const total = tipos.reduce((s, t) => s + peso.get(t)!, 0);
      let r = rng.next() * total;
      for (const t of tipos) {
        r -= peso.get(t)!;
        if (r < 0) return t;
      }
      return tipos[tipos.length - 1];
    };

    // 1) Primera línea mínima.
    const linea = disponibles.filter((t) => PRIMERA_LINEA.includes(t));
    while (elegidas.length < aforo) {
      const gastoLinea = linea.reduce((s, t) => s + (gastado[t] ?? 0), 0);
      if (gastoLinea / presupuesto >= MIN_PRIMERA_LINEA) break;
      const opts = linea.filter(puede);
      if (opts.length === 0) break;
      comprar(elegirPonderado(opts));
    }

    // 2) Resto del presupuesto al azar, respetando topes y aforo.
    while (elegidas.length < aforo) {
      const opts = disponibles.filter(puede);
      if (opts.length === 0) break;
      comprar(elegirPonderado(opts));
    }

    return placeRival(ctx, elegidas);
  }
}
