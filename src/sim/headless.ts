// Equilibrado sin gráficos: ejecuta miles de batallas con la simulación pura
// (sin Phaser) para comprobar el piedra-papel-tijera y la dificultad de las
// oleadas. Ejecutar con: npm run sim
//
// Al no importar Phaser, este archivo corre en Node vía tsx.

import { PredefinedWaveAI } from '../ai/PredefinedWaveAI';
import { RandomRulesAI } from '../ai/RandomRulesAI';
import { cells } from '../deploy/grid';
import { waveName } from '../i18n';
import { fieldFor, UNITS, UNIT_TYPES, unlockedTypes, WAVES } from './data';
import { Rng } from './rng';
import { Simulation } from './Simulation';
import type { Battlefield, PlacedUnit, Team, UnitType } from './types';

// Campo del nivel 1 para la tabla piedra-papel-tijera.
const FIELD = fieldFor(WAVES.oleadas[0]);

/** Coloca n unidades de un tipo en las primeras celdas de un equipo. */
function army(team: Team, type: UnitType, n: number): PlacedUnit[] {
  const cs = cells(FIELD, team);
  const out: PlacedUnit[] = [];
  for (let i = 0; i < n && i < cs.length; i++) {
    out.push({ type, team, x: cs[i].x, y: cs[i].y });
  }
  return out;
}

/** Ejecuta `runs` batallas variando la semilla y devuelve victorias del jugador. */
function winRate(
  player: PlacedUnit[],
  rival: PlacedUnit[],
  runs: number,
  field: Battlefield = FIELD,
): number {
  let wins = 0;
  for (let s = 0; s < runs; s++) {
    const sim = new Simulation(field, [...player, ...rival], s * 131 + 7);
    if (sim.runToEnd() === 'victoria') wins++;
  }
  return wins / runs;
}

function pct(x: number): string {
  return (x * 100).toFixed(0).padStart(3) + '%';
}

console.log('\n=== Piedra-papel-tijera (ejércitos de coste equiparado, 60 pts) ===\n');
console.log('  Lee la celda como: victorias del tipo de la FILA frente al de la COLUMNA.\n');

const BUDGET = 60;
const header = ['         ', ...UNIT_TYPES.map((t) => t.padEnd(12))].join('');
console.log(header);
for (const a of UNIT_TYPES) {
  const row: string[] = [a.padEnd(9)];
  for (const b of UNIT_TYPES) {
    if (a === b) {
      row.push('    —       ');
      continue;
    }
    const na = Math.floor(BUDGET / UNITS[a].cost);
    const nb = Math.floor(BUDGET / UNITS[b].cost);
    const wr = winRate(army('jugador', a, na), army('rival', b, nb), 200);
    row.push((pct(wr) + ` (${na}v${nb})`).padEnd(12));
  }
  console.log(row.join(''));
}

console.log('\n=== Oleadas: ¿son ganables? (mejor composición del jugador dentro del presupuesto) ===\n');

/** Construye un ejército del jugador por conteos, colocándolo por filas. */
function playerArmy(field: Battlefield, counts: Record<UnitType, number>): PlacedUnit[] {
  const cs = cells(field, 'jugador');
  const out: PlacedUnit[] = [];
  let ci = 0;
  for (const t of UNIT_TYPES) {
    for (let k = 0; k < counts[t] && ci < cs.length; k++) {
      out.push({ type: t, team: 'jugador', x: cs[ci].x, y: cs[ci].y });
      ci++;
    }
  }
  return out;
}

/** Composición aleatoria del jugador que gasta todo el presupuesto con los tipos desbloqueados. */
function randomCounts(rng: Rng, waveId: number, presupuesto: number, cap: number): Record<UnitType, number> {
  const counts = Object.fromEntries(UNIT_TYPES.map((t) => [t, 0])) as Record<UnitType, number>;
  const tipos = unlockedTypes(waveId);
  let resto = presupuesto;
  let total = 0;
  while (total < cap) {
    const opts = tipos.filter((t) => UNITS[t].cost <= resto);
    if (opts.length === 0) break;
    const t = opts[rng.int(0, opts.length - 1)];
    counts[t]++;
    resto -= UNITS[t].cost;
    total++;
  }
  return counts;
}

/** Compra por turnos un tipo tras otro (de caro a barato no importa) hasta agotar el presupuesto. */
function referenceCounts(waveId: number, presupuesto: number, cap: number): Record<UnitType, number> {
  const counts = Object.fromEntries(UNIT_TYPES.map((t) => [t, 0])) as Record<UnitType, number>;
  const tipos = unlockedTypes(waveId).filter((t) => t !== 'elefante');
  let resto = presupuesto;
  let total = 0;
  for (let k = 0; total < cap; k++) {
    const t = tipos[k % tipos.length];
    if (UNITS[t].cost > resto) {
      if (tipos.every((u) => UNITS[u].cost > resto)) break;
      continue;
    }
    counts[t]++;
    resto -= UNITS[t].cost;
    total++;
  }
  return counts;
}

const ai = new PredefinedWaveAI();
const aiRandom = new RandomRulesAI();
const MUESTRAS = 150;
for (let i = 0; i < WAVES.oleadas.length; i++) {
  const wave = WAVES.oleadas[i];
  const field = fieldFor(wave);
  const cellCap = field.cols * field.rows;
  const rival = ai.deploy({ wave, field, composicionJugador: {}, seed: 1000 + i });
  // Presupuesto real de la oleada: base + bonus acumulado de las victorias previas.
  const presupuesto = wave.presupuestoJugador + WAVES.bonusVictoria * i;

  // Muestreo de composiciones aleatorias dentro del presupuesto y del aforo.
  const rng = new Rng(77 + i);
  let best = { wr: -1, counts: randomCounts(rng, wave.id, presupuesto, cellCap) };
  for (let m = 0; m < MUESTRAS; m++) {
    const counts = randomCounts(rng, wave.id, presupuesto, cellCap);
    const wr = winRate(playerArmy(field, counts), rival, 12, field);
    if (wr > best.wr) best = { wr, counts };
  }

  const comp = Object.entries(wave.rival)
    .map(([t, n]) => `${n}×${t}`)
    .join(', ');
  const bc = best.counts;
  const bestStr = UNIT_TYPES.map((t) => `${bc[t]}${t.slice(0, 3)}`).join(' ');
  console.log(
    `Oleada ${wave.id} (${waveName(wave.id)}): mejor win ${pct(best.wr)} con [${bestStr}]  |  rival: ${comp}`,
  );

  // Ejército de referencia (presupuesto repartido a partes iguales entre los
  // tipos desbloqueados) frente a la IA nivel 1 y a 8 despliegues de la nivel 2.
  const ref = referenceCounts(wave.id, presupuesto, cellCap);
  const wr1 = winRate(playerArmy(field, ref), rival, 40, field);
  const wrs: number[] = [];
  for (let s = 0; s < 8; s++) {
    const r2 = aiRandom.deploy({ wave, field, composicionJugador: {}, seed: 5000 + s * 31 + i });
    wrs.push(winRate(playerArmy(field, ref), r2, 20, field));
  }
  const avg = wrs.reduce((a, b) => a + b, 0) / wrs.length;
  console.log(
    `   ejército de referencia: vs nivel 1 ${pct(wr1)} | vs nivel 2 media ${pct(avg)} (mín ${pct(Math.min(...wrs))}, máx ${pct(Math.max(...wrs))})`,
  );
}

console.log('');
