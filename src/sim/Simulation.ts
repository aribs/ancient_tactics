// Simulación de combate autónoma. Sin Phaser: avanza por pasos de tiempo
// fijos y expone su estado para que el renderizador lo dibuje, o para
// ejecutarse en bucle sin gráficos y equilibrar.
//
// Modelo: dos ejércitos (jugador a la izquierda, rival a la derecha) avanzan
// hacia la base contraria. Cada unidad persigue al enemigo vivo más cercano
// dentro de su aggro; si no hay ninguno, avanza hacia la base rival y la
// ataca al llegar. La batalla termina cuando un ejército es aniquilado o cae
// una base.

import { BASE_HP, BASE_RADIUS, UNITS } from './data';
import { Rng } from './rng';
import { defensiveAnchor, DEFENSE_DAMAGE_TAKEN, DEFENSE_LEASH, type Stance } from './stance';
import {
  generateTerrain,
  pointInFeature,
  segmentIntersectsCircle,
  TERRAIN,
  type TerrainFeature,
} from './terrain';
import type {
  Battlefield,
  PlacedUnit,
  SimBase,
  SimEvent,
  SimOutcome,
  SimUnit,
  Team,
  TypeStats,
  UnitType,
} from './types';

/** Paso de simulación fijo (s). El render interpola/acumula contra esto. */
export const SIM_DT = 1 / 30;

export class Simulation {
  readonly field: Battlefield;
  units: SimUnit[] = [];
  bases: Record<Team, SimBase>;
  outcome: SimOutcome = 'en_curso';
  tiempo = 0;

  /** Balance por bando y tipo, para el resumen tras la batalla. */
  readonly stats: Record<Team, Partial<Record<UnitType, TypeStats>>> = { jugador: {}, rival: {} };

  /** Eventos del último paso (ataques), que el render consume y limpia. */
  events: SimEvent[] = [];

  /** Accidentes de terreno (para render y consultas). */
  readonly terrain: TerrainFeature[];

  private rng: Rng;
  private nextId = 1;
  private impassables: TerrainFeature[];
  private losBlockers: TerrainFeature[];
  private difficult: TerrainFeature[];

  constructor(
    field: Battlefield,
    placed: PlacedUnit[],
    seed = 1,
    terrain?: TerrainFeature[],
    private playerStance: Stance = 'ataque',
  ) {
    this.field = field;
    this.rng = new Rng(seed);
    // Si no se pasa terreno, se genera de forma determinista desde la semilla
    // (idéntico al que previsualiza la escena de despliegue con esa semilla).
    this.terrain = terrain ?? generateTerrain(seed, field, { min: 3, max: 5 });
    this.impassables = this.terrain.filter((f) => TERRAIN[f.kind].impassable);
    this.losBlockers = this.terrain.filter((f) => TERRAIN[f.kind].blocksLoS);
    this.difficult = this.terrain.filter(
      (f) => !TERRAIN[f.kind].impassable && TERRAIN[f.kind].speedMult < 1,
    );
    this.bases = {
      jugador: this.makeBase('jugador', field.playerBaseX),
      rival: this.makeBase('rival', field.rivalBaseX),
    };
    for (const p of placed) {
      this.units.push(this.makeUnit(p));
    }
  }

  /** Cambia la postura del jugador en caliente (también durante la batalla). */
  setStance(stance: Stance): void {
    this.playerStance = stance;
    for (const u of this.units) {
      if (u.team !== 'jugador') continue;
      u.home = stance === 'defensa' ? defensiveAnchor(this.field, u.start.x, u.start.y) : undefined;
    }
  }

  private makeBase(team: Team, x: number): SimBase {
    return {
      team,
      x,
      y: this.field.baseY,
      hp: BASE_HP,
      maxHp: BASE_HP,
      radius: BASE_RADIUS,
      alive: true,
    };
  }

  private makeUnit(p: PlacedUnit): SimUnit {
    const stats = UNITS[p.type];
    this.statsOf(p.team, p.type).desplegadas++;
    return {
      id: this.nextId++,
      type: p.type,
      team: p.team,
      x: p.x,
      y: p.y,
      hp: stats.hp,
      maxHp: stats.hp,
      cooldown: 0,
      stats,
      targetId: null,
      alive: true,
      start: { x: p.x, y: p.y },
      home:
        p.team === 'jugador' && this.playerStance === 'defensa'
          ? defensiveAnchor(this.field, p.x, p.y)
          : undefined,
    };
  }

  private statsOf(team: Team, type: UnitType): TypeStats {
    return (this.stats[team][type] ??= { desplegadas: 0, bajas: 0, dano: 0, muertes: 0 });
  }

  private enemyTeam(team: Team): Team {
    return team === 'jugador' ? 'rival' : 'jugador';
  }

  /** ¿Está la unidad en pánico (vida por debajo de su umbral)? */
  enPanico(u: SimUnit): boolean {
    const p = u.stats.panico;
    return !!p && u.hp / u.maxHp < p.umbralHp;
  }

  /** Multiplicador de daño del atacante contra el defensor (piedra-papel-tijera). */
  private damageMultiplier(attacker: UnitType, defender: UnitType): number {
    return UNITS[attacker].bonusVs?.[defender] ?? 1;
  }

  /** Avanza la simulación un paso fijo. */
  step(): void {
    if (this.outcome !== 'en_curso') return;
    this.events.length = 0;
    this.tiempo += SIM_DT;

    for (const u of this.units) {
      if (!u.alive) continue;
      this.updateUnit(u);
    }

    this.cleanupDead();
    this.evaluateOutcome();
  }

  private updateUnit(u: SimUnit): void {
    if (u.cooldown > 0) u.cooldown = Math.max(0, u.cooldown - SIM_DT);

    const enemy = this.enemyTeam(u.team);
    const target = this.acquireTarget(u);

    if (!target) {
      // En defensa, sin enemigo a la vista: volver al puesto y esperar.
      if (u.home) this.moveToward(u, u.home.x, u.home.y, 3);
      return;
    }

    const dx = target.x - u.x;
    const dy = target.y - u.y;
    const dist = Math.hypot(dx, dy) || 1;
    const reach = u.stats.attackRange + target.radius;
    const ranged = u.stats.attackRange > 60;

    // Las unidades a distancia necesitan línea de visión despejada; una roca
    // entre medias bloquea el disparo y las obliga a reposicionarse.
    const puedeGolpear =
      dist <= reach && (!ranged || this.hasLineOfSight(u.x, u.y, target.x, target.y));

    if (puedeGolpear) {
      // En alcance y con visión: atacar si el cooldown lo permite.
      if (u.cooldown <= 0) {
        this.attack(u, target);
        u.cooldown = u.stats.attackCooldown;
      }
    } else {
      // Avanzar hacia el objetivo. La velocidad baja en terreno difícil, y las
      // unidades rodean los obstáculos impasables.
      this.moveToward(u, target.x, target.y);
    }

    // El enemigo real usado para el multiplicador se deduce en attack().
    void enemy;
  }

  /** Mueve la unidad un paso hacia (tx,ty); se detiene a `stopAt` de distancia. */
  private moveToward(u: SimUnit, tx: number, ty: number, stopAt = 0): void {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const dist = Math.hypot(dx, dy) || 1;
    const stepLen = dist <= stopAt ? 0 : Math.min(u.stats.speed * this.speedMultAt(u.x, u.y) * SIM_DT, dist - stopAt);
    let nx = u.x + (dx / dist) * stepLen;
    let ny = u.y + (dy / dist) * stepLen;
    const sep = this.separation(u);
    nx += sep.x;
    ny += sep.y;
    const resuelto = this.avoidImpassable(u, nx, ny);
    u.x = clamp(resuelto.x, 0, this.field.width);
    u.y = clamp(resuelto.y, this.field.playTop, this.field.playBottom);
  }

  /** Objetivo: enemigo vivo más cercano dentro de aggro; si no, la base rival. */
  private acquireTarget(u: SimUnit): Targetable | null {
    if (this.enPanico(u)) {
      // Pánico: ataca a la unidad viva más cercana, sea del bando que sea.
      let near: SimUnit | null = null;
      let nearD = u.stats.aggroRange;
      for (const other of this.units) {
        if (other === u || !other.alive) continue;
        const d = Math.hypot(other.x - u.x, other.y - u.y);
        if (d < nearD) {
          nearD = d;
          near = other;
        }
      }
      if (near) {
        u.targetId = near.id;
        return { id: near.id, x: near.x, y: near.y, radius: near.stats.radius, kind: 'unit', unit: near };
      }
    }
    const enemyTeamId = this.enemyTeam(u.team);
    let best: SimUnit | null = null;
    let bestD = Infinity;
    // Objetivo preferente (p. ej. la caballería busca arqueros) si hay alguno
    // dentro de aggro; si no, el enemigo más cercano.
    let bestPref: SimUnit | null = null;
    let bestPrefD = Infinity;
    const pref = u.stats.prefiereObjetivo;
    for (const other of this.units) {
      if (!other.alive || other.team !== enemyTeamId) continue;
      // En defensa solo se combate cerca del puesto; no se persigue más allá.
      if (u.home && Math.hypot(other.x - u.home.x, other.y - u.home.y) > DEFENSE_LEASH) continue;
      const d = Math.hypot(other.x - u.x, other.y - u.y);
      if (d < bestD) {
        bestD = d;
        best = other;
      }
      if (pref && other.type === pref && d < bestPrefD) {
        bestPrefD = d;
        bestPref = other;
      }
    }
    if (bestPref && bestPrefD <= u.stats.aggroRange) {
      best = bestPref;
      bestD = bestPrefD;
    }

    if (best && bestD <= u.stats.aggroRange) {
      u.targetId = best.id;
      return { id: best.id, x: best.x, y: best.y, radius: best.stats.radius, kind: 'unit', unit: best };
    }

    // En defensa no se marcha hacia la base rival: se espera en el puesto.
    if (u.home) {
      u.targetId = null;
      return null;
    }

    // Sin enemigos cerca: marchar hacia la base contraria.
    const base = this.bases[enemyTeamId];
    if (base.alive) {
      u.targetId = -1;
      return { id: -1, x: base.x, y: base.y, radius: base.radius, kind: 'base', base };
    }

    // Si no quedan enemigos cerca y la base ya cayó, buscar el enemigo más
    // lejano igualmente (para rematar).
    if (best) {
      u.targetId = best.id;
      return { id: best.id, x: best.x, y: best.y, radius: best.stats.radius, kind: 'unit', unit: best };
    }
    u.targetId = null;
    return null;
  }

  private attack(u: SimUnit, target: Targetable): void {
    const ranged = u.stats.attackRange > 60;
    if (target.kind === 'unit') {
      const mult = this.damageMultiplier(u.type, target.unit.type);
      // Cobertura: el bosque reduce el daño a distancia a quien está dentro.
      const cover = ranged ? this.coverMultAt(target.unit.x, target.unit.y) : 1;
      // Pequeña varianza determinista para que las batallas no sean idénticas.
      const variance = this.rng.range(0.9, 1.1);
      const formation =
        target.unit.home && Math.hypot(target.unit.x - target.unit.home.x, target.unit.y - target.unit.home.y) < 40
          ? DEFENSE_DAMAGE_TAKEN
          : 1;
      const dmg = u.stats.damage * mult * cover * variance * formation;
      const victima = target.unit;
      const aplicado = Math.min(dmg, Math.max(0, victima.hp));
      victima.hp -= dmg;
      // El fuego amigo (pánico) no cuenta como daño ni muerte del atacante.
      const propio = this.statsOf(u.team, u.type);
      if (victima.team !== u.team) propio.dano += aplicado;
      if (victima.hp <= 0 && victima.alive) {
        victima.alive = false;
        this.statsOf(victima.team, victima.type).bajas++;
        if (victima.team !== u.team) propio.muertes++;
      }
    } else {
      target.base.hp -= u.stats.damage;
      if (target.base.hp <= 0) target.base.alive = false;
    }

    this.events.push({
      kind: 'attack',
      attackerId: u.id,
      attackerTeam: u.team,
      fromX: u.x,
      fromY: u.y,
      toX: target.x,
      toY: target.y,
      ranged,
    });
  }

  // --- Consultas de terreno ------------------------------------------------

  /** Multiplicador de velocidad en (x,y): el menor de los terrenos que lo contienen. */
  private speedMultAt(x: number, y: number): number {
    let m = 1;
    for (const f of this.difficult) {
      if (pointInFeature(f, x, y)) {
        const s = TERRAIN[f.kind].speedMult;
        if (s < m) m = s;
      }
    }
    return m;
  }

  /** Multiplicador de daño a distancia recibido en (x,y) por cobertura. */
  private coverMultAt(x: number, y: number): number {
    let m = 1;
    for (const f of this.terrain) {
      const rm = TERRAIN[f.kind].rangedDamageMult;
      if (rm < 1 && pointInFeature(f, x, y)) {
        if (rm < m) m = rm;
      }
    }
    return m;
  }

  /** ¿Hay visión despejada entre A y B? La corta cualquier roca intermedia. */
  private hasLineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
    for (const f of this.losBlockers) {
      if (segmentIntersectsCircle(ax, ay, bx, by, f.x, f.y, f.radius)) return false;
    }
    return true;
  }

  /** Reubica la posición propuesta fuera de cualquier obstáculo impasable. */
  private avoidImpassable(u: SimUnit, nx: number, ny: number): { x: number; y: number } {
    for (const f of this.impassables) {
      const dx = nx - f.x;
      const dy = ny - f.y;
      const minD = f.radius + u.stats.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD * minD) {
        const d = Math.sqrt(d2) || 0.001;
        // Empujar hasta el borde del obstáculo (la unidad resbala alrededor).
        nx = f.x + (dx / d) * minD;
        ny = f.y + (dy / d) * minD;
      }
    }
    return { x: nx, y: ny };
  }

  /** Empuje suave para que las unidades no se amontonen en el mismo punto. */
  private separation(u: SimUnit): { x: number; y: number } {
    let sx = 0;
    let sy = 0;
    for (const other of this.units) {
      if (other === u || !other.alive) continue;
      const dx = u.x - other.x;
      const dy = u.y - other.y;
      const d2 = dx * dx + dy * dy;
      const minDist = u.stats.radius + other.stats.radius;
      if (d2 > 0 && d2 < minDist * minDist) {
        const d = Math.sqrt(d2);
        const push = (minDist - d) * 0.5;
        sx += (dx / d) * push;
        sy += (dy / d) * push;
      }
    }
    return { x: sx, y: sy };
  }

  private cleanupDead(): void {
    if (this.units.some((u) => !u.alive)) {
      this.units = this.units.filter((u) => u.alive);
    }
  }

  private countAlive(team: Team): number {
    let n = 0;
    for (const u of this.units) if (u.alive && u.team === team) n++;
    return n;
  }

  private evaluateOutcome(): void {
    const jugadorVivos = this.countAlive('jugador');
    const rivalVivos = this.countAlive('rival');

    // El jugador defiende: pierde si cae su base o su ejército.
    if (!this.bases.jugador.alive || jugadorVivos === 0) {
      this.outcome = 'derrota';
      return;
    }
    // Gana la oleada si aniquila al ejército rival.
    if (rivalVivos === 0) {
      this.outcome = 'victoria';
    }
  }

  /** Ejecuta la batalla entera sin render (equilibrado). Devuelve el resultado. */
  runToEnd(maxSeconds = 120): SimOutcome {
    const maxSteps = Math.ceil(maxSeconds / SIM_DT);
    let steps = 0;
    while (this.outcome === 'en_curso' && steps < maxSteps) {
      this.step();
      steps++;
    }
    // Empate por tiempo: el defensor resiste => victoria del jugador.
    if (this.outcome === 'en_curso') this.outcome = 'victoria';
    return this.outcome;
  }
}

type Targetable =
  | { id: number; x: number; y: number; radius: number; kind: 'unit'; unit: SimUnit }
  | { id: number; x: number; y: number; radius: number; kind: 'base'; base: SimBase };

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
