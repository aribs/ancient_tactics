// Estado de la partida: oleada actual, presupuesto y progresión. Sin Phaser.

import type { DeploymentAI } from '../ai/DeploymentAI';
import type { Stance } from '../sim/stance';
import type { Battlefield } from '../sim/types';
import { fieldFor, WAVES, type WaveDef } from '../sim/data';

export class GameState {
  waveIndex = 0;
  /** Puntos extra acumulados al ganar oleadas, sobre el presupuesto base. */
  puntosExtra = 0;
  /** Postura del ejército del jugador (se conserva entre oleadas). */
  stance: Stance = 'ataque';
  /** Semilla de la campaña: cada partida nueva genera terrenos distintos. */
  campaignSeed = newCampaignSeed();
  readonly ai: DeploymentAI;

  constructor(ai: DeploymentAI) {
    this.ai = ai;
  }

  get wave(): WaveDef {
    return WAVES.oleadas[this.waveIndex];
  }

  get esUltima(): boolean {
    return this.waveIndex >= WAVES.oleadas.length - 1;
  }

  /** Presupuesto disponible esta oleada (base de la oleada + extra ganado). */
  get presupuesto(): number {
    return this.wave.presupuestoJugador + this.puntosExtra;
  }

  /** Tablero de la oleada actual (crece con el nivel). */
  get field(): Battlefield {
    return fieldFor(this.wave);
  }

  /** Semilla por oleada: fija dentro de la campaña (reintentar repite el mapa). */
  get seed(): number {
    return (this.campaignSeed + this.waveIndex * 7919) >>> 0;
  }

  /** Avanza a la siguiente oleada tras una victoria, sumando el bonus. */
  avanzarTrasVictoria(): boolean {
    if (this.esUltima) return false;
    this.puntosExtra += WAVES.bonusVictoria;
    this.waveIndex++;
    return true;
  }

  reiniciar(): void {
    this.waveIndex = 0;
    this.puntosExtra = 0;
    this.campaignSeed = newCampaignSeed();
  }
}

function newCampaignSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}
