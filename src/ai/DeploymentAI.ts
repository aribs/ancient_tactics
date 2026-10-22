// Interfaz intercambiable de la IA de despliegue del rival.
//
// El resto del juego solo conoce esta interfaz, de modo que pasar del nivel 1
// (oleadas predefinidas) al 2 (aleatorio con reglas) o al 3 (contra-picking)
// no obliga a tocar las escenas ni la simulación: basta con instanciar otra
// implementación en main.ts.

import type { WaveDef } from '../sim/data';
import type { Battlefield, PlacedUnit, UnitType } from '../sim/types';

/** Información que la IA puede observar al desplegar. */
export interface DeployContext {
  wave: WaveDef;
  /** Campo de esta oleada (define la cuadrícula del rival). */
  field: Battlefield;
  /**
   * Composición ya desplegada por el jugador. El nivel 1 la ignora; existe
   * para que el nivel 3 (contra-picking) pueda leerla sin cambiar la firma.
   */
  composicionJugador: Partial<Record<UnitType, number>>;
  /** Semilla para decisiones deterministas (niveles 2 y 3). */
  seed: number;
}

export interface DeploymentAI {
  readonly nombre: string;
  /** Devuelve las unidades del rival ya colocadas en su zona. */
  deploy(ctx: DeployContext): PlacedUnit[];
}
