// Tipos de la capa de simulación. NO importa Phaser: debe poder ejecutarse
// en Node sin gráficos para equilibrar miles de batallas.

export type UnitType = 'legionario' | 'lancero' | 'arquero' | 'caballeria' | 'elefante';
export type Team = 'jugador' | 'rival';

/** Estadísticas de una unidad, cargadas desde units.json. */
export interface UnitStats {
  id: UnitType;
  nombre: string;
  /** Nombre abreviado para botones estrechos; si falta se usa `nombre`. */
  nombreCorto?: string;
  rol: string;
  hp: number;
  damage: number;
  /** Alcance de ataque en unidades de mundo (melee pequeño, arquero grande). */
  attackRange: number;
  /** Segundos entre ataques. */
  attackCooldown: number;
  /** Velocidad en unidades/segundo. */
  speed: number;
  /** A qué distancia detecta y persigue a un enemigo. */
  aggroRange: number;
  /** Radio del cuerpo, para separación y colisiones de alcance. */
  radius: number;
  cost: number;
  color: string;
  /** Si hay uno a la vista (dentro de aggro), lo ataca antes que al más cercano (flanqueo). */
  prefiereObjetivo?: UnitType;
  /** Multiplicador de daño contra tipos concretos (piedra-papel-tijera). */
  bonusVs?: Partial<Record<UnitType, number>>;
  /** Primera oleada en la que el jugador puede desplegarla (por defecto, la 1). */
  desbloqueoOleada?: number;
  /** Primera oleada en la que el rival la usa (por defecto, `desbloqueoOleada`). */
  desbloqueoRival?: number;
  /** Por debajo de `umbralHp` (fracción de vida) enloquece y ataca a cualquiera, aliados incluidos. */
  panico?: { umbralHp: number };
}

export type UnitTable = Record<UnitType, UnitStats>;

/** Una unidad colocada antes de la batalla (salida de la IA o del jugador). */
export interface PlacedUnit {
  type: UnitType;
  team: Team;
  x: number;
  y: number;
}

/** Entidad viva dentro de la simulación. */
export interface SimUnit {
  id: number;
  type: UnitType;
  team: Team;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  stats: UnitStats;
  /** Posición de despliegue inicial (base del puesto defensivo). */
  start: { x: number; y: number };
  /** Puesto defensivo; solo si el equipo está en postura de defensa. */
  home?: { x: number; y: number };
  /** id del objetivo actual (unidad o base), o null. */
  targetId: number | null;
  alive: boolean;
}

export interface SimBase {
  team: Team;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
}

/** Balance de un tipo de unidad en una batalla (para el resumen final). */
export interface TypeStats {
  desplegadas: number;
  /** Unidades de este tipo que murieron. */
  bajas: number;
  /** Daño infligido a enemigos. */
  dano: number;
  /** Enemigos abatidos. */
  muertes: number;
}

export type SimOutcome = 'victoria' | 'derrota' | 'en_curso';

/** Evento puntual que el renderizador puede dibujar (flecha, impacto…). */
export interface SimEvent {
  kind: 'attack';
  attackerId: number;
  attackerTeam: Team;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  ranged: boolean;
}

/** Dimensiones y puntos fijos del campo de batalla (en unidades de mundo). */
export interface Battlefield {
  /** Ancho del lienzo (= ancho del campo). */
  width: number;
  /** Alto del lienzo: franja de HUD arriba y abajo más la zona de juego. */
  height: number;
  /** Límites verticales de la zona de juego. */
  playTop: number;
  playBottom: number;
  playerBaseX: number;
  rivalBaseX: number;
  baseY: number;
  /** Tamaño de la cuadrícula de despliegue de cada bando. */
  cols: number;
  rows: number;
}
